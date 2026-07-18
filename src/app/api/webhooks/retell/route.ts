import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyRetellWebhook } from '@/lib/retell';
import { upgradeContactStatus, stopActiveSequences, upsertPipelineDeal, scheduleFollowUpEmail, OUTCOME_TO_STATUS } from '@/lib/pipeline-utils';
import { buildOutboundHtml } from '@/lib/email-templates';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    // Verify webhook signature
    const signature = request.headers.get('x-retell-signature') || '';
    if (!(await verifyRetellWebhook(rawBody, signature))) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const eventType = body.event;
    const callData = body.data || body.call || {};
    const callId = callData.call_id;

    if (!callId) {
      return NextResponse.json({ error: 'Missing call_id' }, { status: 400 });
    }

    // Look up booking by retell_call_id
    const bookingResult = await query(
      `SELECT mb.*, c.id as matched_contact_id, c.contact_type, c.status as contact_status, c.name as contact_name, c.org_name
       FROM meeting_bookings mb
       LEFT JOIN contacts c ON mb.contact_id = c.id OR LOWER(c.email) = LOWER(mb.attendee_email)
       WHERE mb.retell_call_id = $1
       LIMIT 1`,
      [callId]
    );

    if (bookingResult.rows.length === 0) {
      console.warn(`Retell webhook: no booking found for call ${callId}`);
      return NextResponse.json({ received: true, action: 'no_booking_match' });
    }

    const booking = bookingResult.rows[0];
    const contactId = booking.matched_contact_id || booking.contact_id;
    const contactType = booking.contact_type || booking.event_type || 'landlord';

    if (eventType === 'call_started') {
      await handleCallStarted(booking);
    } else if (eventType === 'call_ended') {
      await handleCallEnded(callData, booking, contactId, contactType);
    } else if (eventType === 'call_analyzed') {
      await handleCallAnalyzed(callData, booking, contactId, contactType);
    } else {
      console.log(`Retell webhook: unhandled event ${eventType} for call ${callId}`);
    }

    return NextResponse.json({ received: true, event: eventType });
  } catch (error: any) {
    console.error('Retell webhook error:', error);
    return NextResponse.json(
      { error: error.message || 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handleCallStarted(booking: any) {
  await query(
    `UPDATE meeting_bookings SET status = 'active', updated_at = NOW() WHERE id = $1`,
    [booking.id]
  );
}

const NO_ANSWER_REASONS = new Set(['no_answer', 'busy', 'declined', 'voicemail', 'machine_detected']);

async function handleCallEnded(
  callData: any,
  booking: any,
  contactId: number | null,
  contactType: string,
) {
  const callId = callData.call_id;
  const durationMs = callData.end_timestamp && callData.start_timestamp
    ? callData.end_timestamp - callData.start_timestamp
    : null;
  const durationSeconds = durationMs ? Math.round(durationMs / 1000) : null;
  const disconnectReason = callData.disconnection_reason || 'unknown';
  const wasAnswered = !NO_ANSWER_REASONS.has(disconnectReason);
  const bookingStatus = wasAnswered ? 'completed' : 'no_show';

  await query(
    `UPDATE meeting_bookings SET status = $1, updated_at = NOW() WHERE id = $2`,
    [bookingStatus, booking.id]
  );

  await query(
    `INSERT INTO conversation_analytics (conversation_id, booking_id, contact_id, duration_seconds, shutdown_reason, outcome)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (conversation_id) DO UPDATE SET
       duration_seconds = COALESCE(EXCLUDED.duration_seconds, conversation_analytics.duration_seconds),
       shutdown_reason = EXCLUDED.shutdown_reason,
       outcome = COALESCE(conversation_analytics.outcome, EXCLUDED.outcome),
       updated_at = NOW()`,
    [`retell_${callId}`, booking.id, contactId, durationSeconds, disconnectReason, wasAnswered ? null : 'no_show']
  );

  // If call was declined/unanswered, send missed-call email immediately
  if (!wasAnswered && booking.attendee_email) {
    await scheduleMissedCallEmail(booking, contactId, contactType);
    console.log(`Retell call not answered: ${callId}, reason=${disconnectReason}, missed-call email scheduled`);
  } else {
    console.log(`Retell call ended: ${callId}, duration=${durationSeconds}s, reason=${disconnectReason}`);
  }
}

async function handleCallAnalyzed(
  callData: any,
  booking: any,
  contactId: number | null,
  contactType: string,
) {
  const callId = callData.call_id;
  const transcript = callData.transcript || '';
  const retellAnalysis = callData.call_analysis || {};
  const callSummary = callData.call_summary || '';
  const userSentiment = callData.user_sentiment || '';

  if (!transcript) {
    console.warn(`Retell call_analyzed: empty transcript for ${callId}`);
    return;
  }

  // Classify the transcript using Claude
  const classification = await classifyTranscript(transcript, contactType);

  // Build structured call_analysis blob with Retell's data
  const callAnalysisData = {
    retell_outcome: retellAnalysis.outcome || null,
    retell_timeline: retellAnalysis.timeline || null,
    retell_key_topics: retellAnalysis.key_topics || null,
    retell_objections: retellAnalysis.objections || null,
    call_summary: callSummary,
    user_sentiment: userSentiment,
    call_successful: callData.call_successful ?? null,
    disconnection_reason: callData.disconnection_reason || null,
    claude_outcome: classification.outcome,
    raw_analysis: retellAnalysis,
  };

  // Upsert conversation_analytics
  await query(
    `INSERT INTO conversation_analytics (conversation_id, booking_id, contact_id, transcript, outcome, key_topics, objections, next_steps, sentiment, call_analysis)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (conversation_id) DO UPDATE SET
       transcript = EXCLUDED.transcript,
       outcome = EXCLUDED.outcome,
       key_topics = EXCLUDED.key_topics,
       objections = EXCLUDED.objections,
       next_steps = EXCLUDED.next_steps,
       sentiment = EXCLUDED.sentiment,
       call_analysis = EXCLUDED.call_analysis,
       updated_at = NOW()`,
    [
      `retell_${callId}`, booking.id, contactId,
      transcript,
      classification.outcome,
      classification.key_topics,
      classification.objections,
      classification.next_steps,
      userSentiment || null,
      JSON.stringify(callAnalysisData),
    ]
  );

  // Pipeline updates (only if we have a contact)
  if (contactId) {
    // Upgrade contact status
    const newStatus = OUTCOME_TO_STATUS[classification.outcome];
    if (newStatus) {
      await upgradeContactStatus(contactId, newStatus);
    }

    // Stop active email sequences
    await stopActiveSequences(contactId);

    // Upsert pipeline deal
    const dealId = await upsertPipelineDeal(
      contactId,
      contactType,
      classification.outcome,
      `${booking.attendee_name} - Phone Call`,
      booking.org_name || null,
    );

    // Log to activity_log
    await query(
      `INSERT INTO activity_log (deal_id, activity_type, description, metadata)
       VALUES ($1, $2, $3, $4)`,
      [
        dealId,
        'call_completed',
        `AI phone call completed with ${booking.attendee_name}. Outcome: ${classification.outcome}`,
        JSON.stringify({
          call_id: callId,
          outcome: classification.outcome,
          key_topics: classification.key_topics,
        }),
      ]
    );
  }

  // Schedule follow-up email
  if (booking.attendee_email) {
    if (classification.outcome === 'no_show') {
      await scheduleMissedCallEmail(booking, contactId, contactType);
    } else if (classification.outcome !== 'technical_issue') {
      await generateAndScheduleFollowUp(booking, contactId, contactType, classification);
    }
  }

  console.log(`Retell call analyzed: ${callId}, outcome=${classification.outcome}`);
}

async function classifyTranscript(
  transcript: string,
  contactType: string,
): Promise<{ outcome: string; key_topics: string; objections: string; next_steps: string; summary: string }> {
  const fallback = {
    outcome: 'needs_followup',
    key_topics: '',
    objections: '',
    next_steps: 'Follow up with additional information',
    summary: '',
  };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fallback;

  try {
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: `Analyze this sales phone call transcript between an AI phone agent (Robert Gilbert from SweetLease) and a prospect (contact type: ${contactType}).

Classify the outcome and extract key information.

Transcript:
${transcript.substring(0, 4000)}

Respond in JSON format ONLY:
{
  "outcome": "interested" | "needs_followup" | "objection" | "not_interested" | "no_show" | "technical_issue",
  "key_topics": "comma-separated list of main topics discussed",
  "objections": "any objections raised by the prospect, or empty string",
  "next_steps": "recommended next steps based on the conversation",
  "summary": "2-3 sentence summary of the conversation"
}`,
      }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        outcome: parsed.outcome || fallback.outcome,
        key_topics: parsed.key_topics || '',
        objections: parsed.objections || '',
        next_steps: parsed.next_steps || fallback.next_steps,
        summary: parsed.summary || '',
      };
    }
    return fallback;
  } catch (err) {
    console.error('Transcript classification failed:', err);
    return fallback;
  }
}

async function generateAndScheduleFollowUp(
  booking: any,
  contactId: number | null,
  contactType: string,
  classification: { outcome: string; key_topics: string; objections: string; next_steps: string; summary: string },
) {
  const firstName = booking.attendee_name.split(' ')[0];
  let emailSubject: string;
  let emailBody: string;

  // Interested = onboarding email. Everything else = standard follow-up.
  const isOnboarding = classification.outcome === 'interested';

  if (isOnboarding) {
    const onboarding = buildOnboardingEmail(firstName, contactType);
    emailSubject = onboarding.subject;
    emailBody = onboarding.body;
  } else {
    emailSubject = `Great talking with you, ${firstName}`;
    emailBody = `Hi ${firstName},\n\nThank you for taking the time to chat with me today.${classification.key_topics ? ` I enjoyed our conversation about ${classification.key_topics.split(',')[0].trim().toLowerCase()}.` : ''}\n\n${classification.next_steps ? `As discussed, the next steps are: ${classification.next_steps}` : 'I will follow up shortly with the materials we discussed.'}\n\nIf you have any questions in the meantime, feel free to reply to this email.\n\nBest regards,\nRobert Gilbert`;
  }

  const htmlBody = buildOutboundHtml(emailBody);

  await scheduleFollowUpEmail(
    booking.attendee_email,
    contactId,
    contactType,
    emailSubject,
    emailBody,
    htmlBody,
    30 * 60 * 1000,
  );
}

function buildOnboardingEmail(firstName: string, contactType: string): { subject: string; body: string } {
  switch (contactType) {
    case 'landlord':
      return {
        subject: `Welcome to SweetLease, ${firstName} — let's get your units filled`,
        body: `Hi ${firstName},

Great speaking with you today. We are excited to get started and bring qualified tenants to your properties as fast as possible.

To get you onboarded quickly, I just need a couple things:

1. What property management system do you use? (AppFolio, Buildium, Yardi, RentManager, etc.) If you have one, we can connect directly and pull your vacancy data, unit details, and photos automatically — zero manual work on your end.

2. Do you have current listings on Zillow, Apartments.com, or your own website? If so, just reply with the links and we will import everything.

3. If neither of the above, just send me your property addresses and we will handle the rest.

Once I have this, here is what happens next:
- We will build out your property listings within 24-48 hours
- Your units will be immediately visible to our network of pre-screened, corporate-backed tenants
- You will get a dashboard to track applications, placements, and revenue in real time

The sooner we get your properties in the system, the sooner we start filling vacancies. Every day counts.

Best regards,
Robert Gilbert`,
      };

    case 'employer':
      return {
        subject: `Welcome to SweetLease, ${firstName} — your employee housing program`,
        body: `Hi ${firstName},

Great speaking with you today. We are excited to help your team with housing.

Here is what we need to get your program up and running:

1. Who is the best point of contact on your HR or relocation team? I will loop them in so we can coordinate directly.

2. What cities are your employees most commonly relocating to? We will prioritize sourcing housing inventory in those markets first.

3. Do you have any upcoming relocations in the pipeline? If so, we can start placing employees immediately — even before the full program is set up.

Here is what happens on our end:
- We will set up your company profile and branded housing portal within 48 hours
- Your relocating employees will get a direct link to browse verified, below-market apartments
- Your HR team gets a dashboard to track every placement, savings, and satisfaction scores
- First placements can happen within 7 days of referral

Remember, this is completely free for your organization. We handle everything.

Best regards,
Robert Gilbert`,
      };

    case 'university':
      return {
        subject: `Welcome to SweetLease, ${firstName} — launching your student housing portal`,
        body: `Hi ${firstName},

Great speaking with you today. We are excited to partner with your university and give students a better housing option.

To get your branded portal launched, here is what we need:

1. Your university logo and brand colors — we will build a portal that looks and feels like your institution.

2. What neighborhoods or areas near campus should we focus on? We will prioritize onboarding landlords in those zones first.

3. Are there key dates on your academic calendar we should target? (Orientation, housing fairs, admitted student events) We want to time the launch for maximum student impact.

4. Who on your housing office team should we coordinate with day-to-day?

Here is what happens next:
- We will build your branded student housing portal within 1-2 weeks
- We will onboard verified landlords near campus with group-negotiated rates (15-25% below market)
- Your housing office gets a dashboard showing student placement rates, savings, and satisfaction
- Everything is completely free for the university

Students get safe, verified, affordable housing. Your office gets data and a resource to recommend with confidence.

Best regards,
Robert Gilbert`,
      };

    case 'residency':
      return {
        subject: `Welcome to SweetLease, ${firstName} — housing your incoming class`,
        body: `Hi ${firstName},

Great speaking with you today. We know the July scramble is real — let's get ahead of it.

Here is what we need to get started:

1. How many residents are in your incoming cohort? We will source enough hospital-adjacent housing to cover the full class.

2. What is the hospital address? We will focus on housing within a 15-minute commute.

3. Who in your GME office should we coordinate with? We will work directly with them on timing and communications.

4. When does your program send Match Day welcome packets? We want to include the housing portal link so residents can start browsing immediately.

Here is what happens next:
- We will source verified, affordable housing near your hospital within 1-2 weeks
- We will build a cohort landing page your incoming residents can access after Match Day
- Move-in dates will be coordinated with your July start
- Average savings: $267/month per resident ($3,200/year back in their pockets)
- Your program dashboard tracks the entire class — placements, savings, satisfaction

Completely free for your program and your residents.

Best regards,
Robert Gilbert`,
      };

    case 'benefits-platform':
      return {
        subject: `Welcome to SweetLease, ${firstName} — let's scope the integration`,
        body: `Hi ${firstName},

Great speaking with you today. We are excited about the partnership opportunity — housing is a category no one else is offering, and you would be first to market.

To get the technical scoping started, here is what we need:

1. What is your preferred integration approach? We support API, embedded marketplace, or full white-label. Happy to do whatever fits your platform best.

2. Who is the best technical contact on your team? I will connect them with our integration team to kick off a scoping call.

3. What does your timeline look like? If you have an upcoming benefits enrollment period or product launch, we want to align with that.

4. Are there specific compliance requirements we should be aware of? (We are SOC 2 compliant with full audit trails, but happy to go through your security review.)

Here is what happens next:
- I will send over our API documentation and sandbox access within 24 hours
- We will schedule a technical scoping call with your engineering team
- We will define a pilot scope — typically 1-2 employer clients to start
- Target: live integration within 4-6 weeks depending on approach

Your clients get a new benefit category their employees actually want. You get a competitive moat.

Best regards,
Robert Gilbert`,
      };

    case 'graduate-housing':
      return {
        subject: `Welcome to SweetLease, ${firstName} — supporting your grad students`,
        body: `Hi ${firstName},

Great speaking with you today. Graduate students are often the most underserved when it comes to housing support — we are going to change that.

Here is what we need to get started:

1. Who in your graduate housing office should we coordinate with day-to-day?

2. What neighborhoods near campus should we focus on? We will prioritize onboarding landlords with flexible lease terms in those areas.

3. What are your key move-in periods? Unlike undergrads, grad students often arrive mid-year — we will make sure housing is available year-round, not just fall.

4. What percentage of your grad students are international? We will flag landlords who are experienced with international tenants and flexible documentation requirements.

Here is what happens next:
- We will build your graduate housing portal within 1-2 weeks
- We will onboard landlords with stipend-friendly pricing and flexible lease terms
- Your graduate office gets a dashboard showing placements, savings, and satisfaction
- Completely free for the university

Average savings: $125/month per student. For a grad student on a stipend, that is meaningful.

Best regards,
Robert Gilbert`,
      };

    default:
      return {
        subject: `Welcome to SweetLease, ${firstName} — next steps`,
        body: `Hi ${firstName},

Thank you for the great conversation today and for choosing to move forward with SweetLease. We are excited to work with you.

Here is what happens next:

1. I will put together a custom proposal based on what we discussed and send it over within 24-48 hours.
2. We will start identifying the best options in your area right away.
3. I will introduce you to your dedicated account contact who will walk you through onboarding.

If you have any questions in the meantime, just reply to this email.

Best regards,
Robert Gilbert`,
      };
  }
}

async function scheduleMissedCallEmail(
  booking: any,
  contactId: number | null,
  contactType: string,
) {
  const firstName = booking.attendee_name.split(' ')[0];
  const bookingUrl = process.env.CALCOM_BOOKING_URL || 'https://cal.com/terrell-gilbert-bnq7m3/sweetlease-intro';

  const emailSubject = `Sorry I missed you, ${firstName}`;
  const emailBody = `Hi ${firstName},

I tried giving you a call just now but was not able to reach you. No worries at all — I know schedules get hectic.

I would still love to chat about how SweetLease can help. Here are two easy ways to connect:

1. Pick a new time that works for you: ${bookingUrl}
2. Just reply to this email and I will get back to you within a few hours.

Looking forward to connecting.

Best regards,
Robert Gilbert`;

  const htmlBody = buildOutboundHtml(emailBody);

  await scheduleFollowUpEmail(
    booking.attendee_email,
    contactId,
    contactType,
    emailSubject,
    emailBody,
    htmlBody,
    5 * 60 * 1000, // 5 min delay — send quickly after missed call
  );
}
