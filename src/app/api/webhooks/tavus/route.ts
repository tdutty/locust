import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import Anthropic from '@anthropic-ai/sdk';
import { buildOutboundHtml } from '@/lib/email-templates';

// Status rank for "only upgrade, never downgrade" logic (mirrors process-inbox)
const STATUS_RANK: Record<string, number> = {
  new: 0,
  contacted: 1,
  replied: 2,
  qualified: 3,
  disqualified: 4,
};

// Outcome → contact status mapping
const OUTCOME_TO_STATUS: Record<string, string> = {
  interested: 'qualified',
  needs_followup: 'qualified',
  objection: 'replied',
  not_interested: 'disqualified',
};

// Outcome → deal stage/probability (mirrors process-inbox)
const OUTCOME_TO_DEAL: Record<string, { stage: string; probability: number; next_action: string }> = {
  interested: { stage: 'qualified', probability: 50, next_action: 'Send proposal within 24 hours' },
  needs_followup: { stage: 'qualified', probability: 35, next_action: 'Follow up with additional information' },
  objection: { stage: 'contacted', probability: 15, next_action: 'Address objections, follow up in 1-2 weeks' },
  not_interested: { stage: 'closed', probability: 0, next_action: 'Removed from active pipeline' },
  no_show: { stage: 'contacted', probability: 10, next_action: 'Reschedule meeting' },
  technical_issue: { stage: 'contacted', probability: 20, next_action: 'Reschedule meeting' },
};

// Default deal values by contact type (mirrors process-inbox)
const DEFAULT_DEAL_VALUE: Record<string, number> = {
  landlord: 5000,
  employer: 25000,
  university: 10000,
  residency: 8000,
  'benefits-platform': 25000,
  'graduate-housing': 10000,
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const eventType = body.event_type || body.event;
    const conversationId = body.conversation_id;

    if (!conversationId) {
      return NextResponse.json({ error: 'Missing conversation_id' }, { status: 400 });
    }

    // Verify conversation exists in meeting_bookings
    const bookingResult = await query(
      `SELECT mb.*, c.id as matched_contact_id, c.contact_type, c.status as contact_status, c.name as contact_name, c.org_name
       FROM meeting_bookings mb
       LEFT JOIN contacts c ON LOWER(c.email) = LOWER(mb.attendee_email)
       WHERE mb.tavus_conversation_id = $1
       LIMIT 1`,
      [conversationId]
    );

    if (bookingResult.rows.length === 0) {
      console.warn(`Tavus webhook: no booking found for conversation ${conversationId}`);
      return NextResponse.json({ received: true, action: 'no_booking_match' });
    }

    const booking = bookingResult.rows[0];
    const contactId = booking.matched_contact_id || booking.contact_id;
    const contactType = booking.contact_type || booking.event_type || 'landlord';

    // Route by event type
    if (eventType === 'system.shutdown') {
      await handleShutdown(body, booking, contactId);
    } else if (eventType === 'application.transcription_ready') {
      await handleTranscription(body, booking, contactId, contactType);
    } else if (eventType === 'application.perception_analysis') {
      await handlePerception(body, booking, contactId);
    } else {
      console.log(`Tavus webhook: unhandled event type ${eventType} for conversation ${conversationId}`);
    }

    return NextResponse.json({ received: true, event: eventType });
  } catch (error: any) {
    console.error('Tavus webhook error:', error);
    return NextResponse.json(
      { error: error.message || 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

/**
 * system.shutdown — conversation ended
 */
async function handleShutdown(
  body: any,
  booking: any,
  contactId: number | null,
) {
  const conversationId = body.conversation_id;
  const durationSeconds = body.properties?.duration || body.duration || null;
  const shutdownReason = body.properties?.shutdown_reason || body.shutdown_reason || 'unknown';

  // Update booking status
  await query(
    `UPDATE meeting_bookings SET status = 'completed', updated_at = NOW() WHERE id = $1`,
    [booking.id]
  );

  // Upsert conversation_analytics
  await query(
    `INSERT INTO conversation_analytics (conversation_id, booking_id, contact_id, duration_seconds, shutdown_reason)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (conversation_id) DO UPDATE SET
       duration_seconds = COALESCE(EXCLUDED.duration_seconds, conversation_analytics.duration_seconds),
       shutdown_reason = EXCLUDED.shutdown_reason,
       updated_at = NOW()`,
    [conversationId, booking.id, contactId, durationSeconds, shutdownReason]
  );

  console.log(`Tavus shutdown: conversation ${conversationId}, duration=${durationSeconds}s, reason=${shutdownReason}`);
}

/**
 * application.transcription_ready — full transcript available
 */
async function handleTranscription(
  body: any,
  booking: any,
  contactId: number | null,
  contactType: string,
) {
  const conversationId = body.conversation_id;
  const transcript = body.properties?.transcript || body.transcript || '';

  if (!transcript) {
    console.warn(`Tavus transcription_ready: empty transcript for ${conversationId}`);
    return;
  }

  // AI-classify the transcript
  const classification = await classifyTranscript(transcript, contactType);

  // Upsert conversation_analytics with transcript + classification
  await query(
    `INSERT INTO conversation_analytics (conversation_id, booking_id, contact_id, transcript, outcome, key_topics, objections, next_steps)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (conversation_id) DO UPDATE SET
       transcript = EXCLUDED.transcript,
       outcome = EXCLUDED.outcome,
       key_topics = EXCLUDED.key_topics,
       objections = EXCLUDED.objections,
       next_steps = EXCLUDED.next_steps,
       updated_at = NOW()`,
    [
      conversationId, booking.id, contactId,
      transcript,
      classification.outcome,
      classification.key_topics,
      classification.objections,
      classification.next_steps,
    ]
  );

  // Update contact status (only upgrade, never downgrade — mirrors process-inbox)
  if (contactId) {
    const newStatus = OUTCOME_TO_STATUS[classification.outcome];
    if (newStatus) {
      const contactResult = await query(`SELECT status FROM contacts WHERE id = $1`, [contactId]);
      if (contactResult.rows.length > 0) {
        const currentRank = STATUS_RANK[contactResult.rows[0].status] ?? 0;
        const newRank = STATUS_RANK[newStatus] ?? 0;
        if (newRank > currentRank) {
          await query(
            `UPDATE contacts SET status = $1, updated_at = NOW() WHERE id = $2`,
            [newStatus, contactId]
          );

          // Stop active sequences on any status change
          await query(
            `UPDATE contact_sequences SET status = 'stopped', updated_at = NOW()
             WHERE contact_id = $1 AND status = 'active'`,
            [contactId]
          ).catch(() => {});
        }
      }
    }
  }

  // Create or update pipeline deal (mirrors process-inbox)
  const dealConfig = OUTCOME_TO_DEAL[classification.outcome];
  if (contactId && dealConfig) {
    const existingDeal = await query(
      `SELECT * FROM pipeline_deals WHERE contact_id = $1 LIMIT 1`,
      [contactId]
    );

    let dealId: number;

    if (existingDeal.rows.length > 0) {
      dealId = existingDeal.rows[0].id;
      await query(
        `UPDATE pipeline_deals SET stage = $1, probability = $2, next_action = $3, updated_at = NOW() WHERE id = $4`,
        [dealConfig.stage, dealConfig.probability, dealConfig.next_action, dealId]
      );
    } else {
      const dealType = ['landlord', 'employer', 'university', 'residency', 'benefits-platform', 'graduate-housing'].includes(contactType)
        ? contactType : 'landlord';
      const dealValue = DEFAULT_DEAL_VALUE[contactType] || 5000;

      const newDeal = await query(
        `INSERT INTO pipeline_deals (name, company, contact_id, type, stage, value, probability, next_action)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          `${booking.attendee_name} - ${booking.org_name || 'Meeting'}`,
          booking.org_name || null,
          contactId,
          dealType,
          dealConfig.stage,
          dealValue,
          dealConfig.probability,
          dealConfig.next_action,
        ]
      );
      dealId = newDeal.rows[0].id;
    }

    // Log meeting_completed to activity_log
    await query(
      `INSERT INTO activity_log (deal_id, activity_type, description, metadata)
       VALUES ($1, $2, $3, $4)`,
      [
        dealId,
        'meeting_completed',
        `AI meeting completed with ${booking.attendee_name}. Outcome: ${classification.outcome}`,
        JSON.stringify({
          conversation_id: conversationId,
          outcome: classification.outcome,
          key_topics: classification.key_topics,
          duration: booking.duration_seconds,
        }),
      ]
    );
  }

  // Schedule follow-up email 30 min after call end
  if (booking.attendee_email && classification.outcome !== 'no_show' && classification.outcome !== 'technical_issue') {
    await scheduleFollowUpEmail(booking, contactId, contactType, classification);
  }

  console.log(`Tavus transcription: conversation ${conversationId}, outcome=${classification.outcome}`);
}

/**
 * application.perception_analysis — real-time sentiment/engagement
 */
async function handlePerception(
  body: any,
  booking: any,
  contactId: number | null,
) {
  const conversationId = body.conversation_id;
  const perceptionData = body.properties || body.perception || {};
  const sentiment = perceptionData.sentiment || perceptionData.emotion || null;
  const engagementScore = perceptionData.engagement_score ?? perceptionData.attention_score ?? null;

  await query(
    `INSERT INTO conversation_analytics (conversation_id, booking_id, contact_id, sentiment, engagement_score, perception_data)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (conversation_id) DO UPDATE SET
       sentiment = COALESCE(EXCLUDED.sentiment, conversation_analytics.sentiment),
       engagement_score = COALESCE(EXCLUDED.engagement_score, conversation_analytics.engagement_score),
       perception_data = COALESCE(EXCLUDED.perception_data, conversation_analytics.perception_data),
       updated_at = NOW()`,
    [conversationId, booking.id, contactId, sentiment, engagementScore, JSON.stringify(perceptionData)]
  );
}

/**
 * Classify transcript using Claude Sonnet
 */
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
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: `Analyze this sales call transcript between an AI avatar (Robert Gilbert from SweetLease) and a prospect (contact type: ${contactType}).

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

/**
 * Schedule AI-generated follow-up email 30 min after call
 */
async function scheduleFollowUpEmail(
  booking: any,
  contactId: number | null,
  contactType: string,
  classification: { outcome: string; key_topics: string; objections: string; next_steps: string; summary: string },
) {
  // Dedup: skip if pending follow-up already exists
  const pending = await query(
    `SELECT id FROM scheduled_emails
     WHERE to_email = $1 AND status = 'pending'
     AND created_at > NOW() - INTERVAL '24 hours'
     LIMIT 1`,
    [booking.attendee_email]
  );
  if (pending.rows.length > 0) return;

  const firstName = booking.attendee_name.split(' ')[0];
  let emailBody: string;
  let emailSubject: string;

  // Try AI-generated follow-up
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    try {
      const client = new Anthropic({ apiKey });
      const message = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: `Write a brief follow-up email from Robert Gilbert (SweetLease) to ${booking.attendee_name} after their video meeting. Keep it under 150 words, professional tone.

Context:
- Contact type: ${contactType}
- Conversation summary: ${classification.summary}
- Key topics discussed: ${classification.key_topics}
- Next steps identified: ${classification.next_steps}
- Any objections: ${classification.objections || 'None'}

Rules:
- Reference specific things from the conversation naturally
- Include the agreed-upon next steps
- Sign off with "Best regards," then "Robert Gilbert" on the next line
- Do NOT include a subject line in the body

Respond in JSON format: {"subject": "...", "body": "..."}`,
        }],
      });

      const text = message.content[0].type === 'text' ? message.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        emailSubject = parsed.subject;
        emailBody = parsed.body;
      } else {
        throw new Error('No JSON in response');
      }
    } catch {
      // Fallback to template
      emailSubject = `Great connecting today, ${firstName}`;
      emailBody = buildFallbackEmail(firstName, classification);
    }
  } else {
    emailSubject = `Great connecting today, ${firstName}`;
    emailBody = buildFallbackEmail(firstName, classification);
  }

  const htmlBody = buildOutboundHtml(emailBody);
  const scheduledFor = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min from now

  await query(
    `INSERT INTO scheduled_emails (contact_id, to_email, subject, body, html_body, lead_type, scheduled_for)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [contactId, booking.attendee_email, emailSubject, emailBody, htmlBody, contactType, scheduledFor]
  );

  console.log(`Follow-up email scheduled for ${booking.attendee_email} at ${scheduledFor}`);
}

function buildFallbackEmail(firstName: string, classification: { key_topics: string; next_steps: string }): string {
  return `Hi ${firstName},

Thank you for taking the time to meet with me today. I enjoyed our conversation${classification.key_topics ? ` about ${classification.key_topics.split(',')[0].trim().toLowerCase()}` : ''}.

${classification.next_steps ? `As discussed, the next steps are: ${classification.next_steps}` : 'I will follow up shortly with the materials we discussed.'}

If you have any questions in the meantime, feel free to reply to this email.

Best regards,
Robert Gilbert`;
}
