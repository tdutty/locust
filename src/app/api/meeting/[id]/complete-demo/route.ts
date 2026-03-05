import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { buildOutboundHtml } from '@/lib/email-templates';
import { upgradeContactStatus, stopActiveSequences, upsertPipelineDeal, scheduleFollowUpEmail, OUTCOME_TO_STATUS } from '@/lib/pipeline-utils';
import Anthropic from '@anthropic-ai/sdk';

// Timeline → outcome + probability mapping
const TIMELINE_TO_OUTCOME: Record<string, { outcome: string; probability: number }> = {
  immediately: { outcome: 'interested', probability: 50 },
  within_30_days: { outcome: 'interested', probability: 50 },
  next_quarter: { outcome: 'needs_followup', probability: 35 },
  just_exploring: { outcome: 'needs_followup', probability: 20 },
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { qualificationData, email } = body;

    if (!qualificationData) {
      return NextResponse.json({ error: 'Missing qualification data' }, { status: 400 });
    }

    // 1. Fetch booking + contact
    const bookingResult = await query(
      `SELECT mb.*, c.id as matched_contact_id, c.contact_type, c.status as contact_status, c.name as contact_name, c.org_name
       FROM meeting_bookings mb
       LEFT JOIN contacts c ON mb.contact_id = c.id
       WHERE mb.id = $1
       LIMIT 1`,
      [id]
    );

    if (bookingResult.rows.length === 0) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const booking = bookingResult.rows[0];

    // If no contact_id on booking, try matching by email
    let contactId = booking.matched_contact_id || booking.contact_id;
    let contactType = booking.contact_type || booking.event_type || 'employer';
    let contactName = booking.contact_name || booking.attendee_name;
    let orgName = booking.org_name;

    if (!contactId) {
      const contactResult = await query(
        `SELECT id, contact_type, name, org_name FROM contacts WHERE LOWER(email) = LOWER($1) LIMIT 1`,
        [booking.attendee_email]
      );
      if (contactResult.rows.length > 0) {
        contactId = contactResult.rows[0].id;
        contactType = contactResult.rows[0].contact_type || contactType;
        contactName = contactResult.rows[0].name || contactName;
        orgName = contactResult.rows[0].org_name || orgName;
      }
    }

    // 2. Store qualification_data + demo_completed_at on booking
    await query(
      `UPDATE meeting_bookings
       SET qualification_data = $1, demo_completed_at = NOW(), status = 'completed', updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify(qualificationData), id]
    );

    // Update email if changed
    if (email && email !== booking.attendee_email) {
      await query(
        `UPDATE meeting_bookings SET attendee_email = $1 WHERE id = $2`,
        [email, id]
      );
    }

    const finalEmail = email || booking.attendee_email;
    const timeline = qualificationData.timeline || 'just_exploring';
    const { outcome, probability } = TIMELINE_TO_OUTCOME[timeline] || TIMELINE_TO_OUTCOME.just_exploring;

    // 3. Create/update pipeline deal
    let dealId: number | null = null;
    if (contactId) {
      dealId = await upsertPipelineDeal(
        contactId,
        contactType,
        outcome,
        `${contactName} - Demo Walkthrough`,
        orgName || null,
      );

      // 4. Log demo_completed to activity_log
      await query(
        `INSERT INTO activity_log (deal_id, activity_type, description, metadata)
         VALUES ($1, $2, $3, $4)`,
        [
          dealId,
          'demo_completed',
          `Self-service demo completed by ${contactName}. Timeline: ${timeline}`,
          JSON.stringify({
            qualification_data: qualificationData,
            outcome,
            probability,
            timeline,
          }),
        ]
      );

      // 5. Upgrade contact status
      const newStatus = OUTCOME_TO_STATUS[outcome];
      if (newStatus) {
        await upgradeContactStatus(contactId, newStatus);
      }

      // 6. Stop active email sequences
      await stopActiveSequences(contactId);
    }

    // 7. Schedule AI-generated follow-up email
    if (finalEmail) {
      await generateAndScheduleFollowUp(
        finalEmail,
        contactId,
        contactType,
        contactName,
        qualificationData,
        timeline,
        outcome,
      );
    }

    return NextResponse.json({ success: true, outcome, dealId });
  } catch (error: any) {
    console.error('Complete demo error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to complete demo' },
      { status: 500 }
    );
  }
}

async function generateAndScheduleFollowUp(
  toEmail: string,
  contactId: number | null,
  contactType: string,
  contactName: string,
  qualificationData: Record<string, any>,
  timeline: string,
  outcome: string,
) {
  const firstName = contactName.split(' ')[0];
  let emailSubject: string;
  let emailBody: string;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    try {
      const client = new Anthropic({ apiKey });
      const message = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: `Write a brief follow-up email from Robert Gilbert (SweetLease) to ${contactName} after they completed a self-service demo walkthrough. Keep it under 150 words, professional tone.

Context:
- Contact type: ${contactType}
- Their answers during the walkthrough: ${JSON.stringify(qualificationData)}
- Timeline interest: ${timeline}
- Overall interest level: ${outcome}
${qualificationData.additional_notes ? `- Additional notes from prospect: ${qualificationData.additional_notes}` : ''}

Rules:
- Thank them for taking the walkthrough
- Reference their specific situation based on their answers
- Mention that Robert will personally reach out within 24 hours with a custom proposal
- If they said "immediately" or "within_30_days", be more urgent in tone
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
      emailSubject = `Thanks for exploring SweetLease, ${firstName}`;
      emailBody = buildFallbackEmail(firstName, qualificationData, timeline);
    }
  } else {
    emailSubject = `Thanks for exploring SweetLease, ${firstName}`;
    emailBody = buildFallbackEmail(firstName, qualificationData, timeline);
  }

  const htmlBody = buildOutboundHtml(emailBody);

  await scheduleFollowUpEmail(
    toEmail,
    contactId,
    contactType,
    emailSubject,
    emailBody,
    htmlBody,
    30 * 60 * 1000, // 30 min delay
  );
}

function buildFallbackEmail(firstName: string, qualificationData: Record<string, any>, timeline: string): string {
  const urgent = timeline === 'immediately' || timeline === 'within_30_days';

  return `Hi ${firstName},

Thank you for taking a few minutes to walk through how SweetLease works. I appreciate you sharing details about your needs.

${urgent
    ? 'Based on what you shared, I believe we can move quickly. I will personally reach out within 24 hours with a custom proposal tailored to your situation.'
    : 'I will personally review what you shared and reach out within 24 hours with a custom proposal tailored to your situation.'}

${qualificationData.additional_notes ? `I noted your comment: "${qualificationData.additional_notes}" — I will make sure to address that when we connect.` : ''}

If you have any questions in the meantime, feel free to reply directly to this email.

Best regards,
Robert Gilbert`;
}
