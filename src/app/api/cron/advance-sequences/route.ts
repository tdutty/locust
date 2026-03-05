import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import {
  generateWithAI,
  getSequenceForType,
  getMaxSteps,
  buildOutboundHtml,
  calculateNextBusinessDay,
  fetchCalcomSlots,
  buildTimeSlotsHtml,
  buildTimeSlotsText,
  LeadInfo,
} from '@/lib/email-templates';
import { buildContractDocsHtml } from '@/lib/reply-generator';

function validateCronAuth(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ') && authHeader.slice(7) === cronSecret) {
    return true;
  }

  const { searchParams } = new URL(request.url);
  return searchParams.get('secret') === cronSecret;
}

export async function GET(request: NextRequest) {
  if (!validateCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch active sequences that are due
    const result = await query(
      `SELECT cs.*, c.name, c.email, c.org_name, c.city, c.state, c.contact_type,
              c.title, c.org_employee_count
       FROM contact_sequences cs
       JOIN contacts c ON c.id = cs.contact_id
       WHERE cs.status = 'active' AND cs.next_send_at <= NOW()
       ORDER BY cs.next_send_at ASC
       LIMIT 50`
    );

    let advanced = 0;
    let stopped = 0;
    let completed = 0;

    for (const seq of result.rows) {
      try {
        // Check if contact has replied
        const contact = await query(
          `SELECT status FROM contacts WHERE id = $1`,
          [seq.contact_id]
        );
        const contactStatus = contact.rows[0]?.status;

        if (['replied', 'qualified', 'disqualified'].includes(contactStatus)) {
          // Also check response_log for replies
          await query(
            `UPDATE contact_sequences SET status = 'stopped', updated_at = NOW() WHERE id = $1`,
            [seq.id]
          );
          stopped++;
          continue;
        }

        // Check response_log for any replies from this contact's email
        const replies = await query(
          `SELECT id FROM response_log WHERE from_email = $1 LIMIT 1`,
          [seq.email]
        );
        if (replies.rows.length > 0) {
          await query(
            `UPDATE contact_sequences SET status = 'stopped', updated_at = NOW() WHERE id = $1`,
            [seq.id]
          );
          stopped++;
          continue;
        }

        // Check if max steps reached
        const nextStep = seq.current_step + 1;
        if (nextStep > seq.max_steps) {
          await query(
            `UPDATE contact_sequences SET status = 'completed', updated_at = NOW() WHERE id = $1`,
            [seq.id]
          );
          completed++;
          continue;
        }

        // Build lead info for template/AI generation
        const lead: LeadInfo = {
          name: seq.name,
          email: seq.email,
          orgName: seq.org_name,
          company: seq.org_name,
          university: seq.org_name,
          city: seq.city,
          state: seq.state,
          title: seq.title,
          orgEmployeeCount: seq.org_employee_count,
        };

        const contactType = seq.contact_type || seq.contact_type_seq || 'employer';

        // Try AI generation first
        let emailContent = await generateWithAI(lead, contactType, nextStep);

        // Fall back to template
        if (!emailContent) {
          const sequences = getSequenceForType(contactType);
          const index = Math.min(nextStep - 1, sequences.length - 1);
          const template = sequences[index];

          let subject = template.subject
            .replace(/\{\{company\}\}/g, lead.company || lead.name)
            .replace(/\{\{university\}\}/g, lead.university || lead.name)
            .replace(/\{\{orgName\}\}/g, lead.orgName || lead.company || lead.name)
            .replace(/\{\{city\}\}/g, lead.city || 'your area');

          emailContent = {
            subject,
            body: template.body(lead),
          };
        }

        // Fetch dynamic Cal.com time slots for follow-up emails
        const slots = await fetchCalcomSlots();

        // Build HTML and inject time-slot buttons before signature
        let htmlBody = buildOutboundHtml(emailContent.body);
        if (slots) {
          const slotsHtml = buildTimeSlotsHtml(slots);
          htmlBody = htmlBody.replace(
            '<div style="border-top:1px solid #e2e8f0;padding-top:16px;margin-top:4px;">',
            `${slotsHtml}<div style="border-top:1px solid #e2e8f0;padding-top:16px;margin-top:4px;">`
          );
        }

        // Schedule email for immediate pickup by send-emails cron
        await query(
          `INSERT INTO scheduled_emails (contact_id, to_email, subject, body, html_body, lead_type, scheduled_for)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [seq.contact_id, seq.email, emailContent.subject, emailContent.body, htmlBody, contactType]
        );

        // Update sequence
        const nextSendAt = calculateNextBusinessDay(new Date(), 7);
        await query(
          `UPDATE contact_sequences
           SET current_step = $1, last_sent_at = NOW(), next_send_at = $2, updated_at = NOW()
           WHERE id = $3`,
          [nextStep, nextSendAt.toISOString(), seq.id]
        );

        advanced++;
      } catch (seqErr) {
        console.error(`Error advancing sequence ${seq.id}:`, seqErr);
      }
    }

    // ─── Stale contract follow-ups (escalating: 3d gentle, 5d firm, 7d final) ──
    let contractFollowUps = 0;

    // Find deals in contract stages stale for 3+ days with no pending emails in the last 48h
    const staleDealResult = await query(
      `SELECT pd.*, c.name AS contact_name, c.email AS contact_email, c.contact_type, c.org_name,
              (SELECT COUNT(*) FROM activity_log al WHERE al.deal_id = pd.id AND al.activity_type = 'contract_followup') AS followup_count
       FROM pipeline_deals pd
       JOIN contacts c ON c.id = pd.contact_id
       WHERE pd.stage IN ('contract_sent', 'security_review')
         AND pd.updated_at < NOW() - INTERVAL '3 days'
         AND c.email IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM scheduled_emails se
           WHERE se.contact_id = pd.contact_id
             AND se.status = 'pending'
             AND se.created_at > NOW() - INTERVAL '48 hours'
         )
       LIMIT 20`
    );

    for (const deal of staleDealResult.rows) {
      try {
        const followupCount = parseInt(deal.followup_count) || 0;
        const firstName = deal.contact_name.split(' ')[0];
        const stageLabel = deal.stage === 'security_review' ? 'security review' : 'contract documents';

        // Determine reminder tier based on how many follow-ups already sent
        let subject: string;
        let paragraphs: string[];
        let nextAction: string;

        if (followupCount === 0) {
          // Tier 1: Gentle check-in (3 days)
          subject = `Re: SweetLease — checking in on ${stageLabel}`;
          paragraphs = [
            `Dear ${firstName},`,
            `I wanted to follow up on the ${stageLabel} we sent over. Please let me know if you have any questions or if there is anything I can help clarify for your team.`,
            `I am happy to schedule a brief call to walk through the terms, or to address any items your legal or procurement team may need.`,
          ];
          nextAction = 'Gentle follow-up sent (day 3), next reminder at day 5';
        } else if (followupCount === 1) {
          // Tier 2: Firm follow-up (5 days)
          subject = `Re: SweetLease ${stageLabel} — any questions?`;
          paragraphs = [
            `Dear ${firstName},`,
            `I wanted to circle back on the ${stageLabel} we shared. I understand these reviews can take time, but I want to make sure nothing is holding things up on our end.`,
            `If there are specific items your legal or procurement team needs addressed, I am happy to get on a call to resolve them. We can typically turn around any requested revisions within 24 hours.`,
          ];
          nextAction = 'Firm follow-up sent (day 5), final reminder at day 7';
        } else if (followupCount === 2) {
          // Tier 3: Final follow-up (7 days)
          subject = `Re: SweetLease — final check on ${stageLabel}`;
          paragraphs = [
            `Dear ${firstName},`,
            `I am reaching out one more time regarding the ${stageLabel}. I want to respect your time, so this will be my last follow-up on this topic.`,
            `If the timing is not right, I completely understand. When you are ready to revisit, the documents will be here and I am happy to assist. Otherwise, please let me know if there is anything I can do to help move things forward.`,
          ];
          nextAction = 'Final follow-up sent (day 7), no further automatic reminders';
        } else {
          // Already sent 3 reminders — skip
          continue;
        }

        const body = paragraphs.join('\n\n') + '\n\nBest regards,';
        const htmlBody = buildOutboundHtml(body);

        await query(
          `INSERT INTO scheduled_emails (contact_id, to_email, subject, body, html_body, lead_type, scheduled_for)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [deal.contact_id, deal.contact_email, subject, body, htmlBody, deal.contact_type || 'landlord']
        );

        await query(
          `UPDATE pipeline_deals SET next_action = $1, updated_at = NOW() WHERE id = $2`,
          [nextAction, deal.id]
        );

        await query(
          `INSERT INTO activity_log (deal_id, activity_type, description, metadata)
           VALUES ($1, $2, $3, $4)`,
          [deal.id, 'contract_followup',
           `Follow-up #${followupCount + 1} sent to ${deal.contact_name} — ${stageLabel}`,
           JSON.stringify({ stage: deal.stage, contact_email: deal.contact_email, tier: followupCount + 1 })]
        );

        // Notify admin on the final follow-up (tier 3) — deal may need manual intervention
        if (followupCount === 2) {
          const adminSubject = `[Stale Contract] ${deal.contact_name}${deal.org_name ? ` — ${deal.org_name}` : ''} — 3 reminders sent`;
          const adminBody = `Final automated follow-up has been sent for deal #${deal.id} (${deal.contact_name}). The ${stageLabel} have been pending for 7+ days with no response after 3 reminders. Manual intervention may be needed.`;
          const adminHtml = buildOutboundHtml(adminBody);

          await query(
            `INSERT INTO scheduled_emails (to_email, subject, body, html_body, lead_type, scheduled_for)
             VALUES ($1, $2, $3, $4, $5, NOW())`,
            ['admin@sweetlease.io', adminSubject, adminBody, adminHtml, 'internal']
          );
        }

        contractFollowUps++;
      } catch (followUpErr) {
        console.error(`Error sending contract follow-up for deal ${deal.id}:`, followUpErr);
      }
    }

    return NextResponse.json({
      processed: result.rows.length,
      advanced,
      stopped,
      completed,
      contractFollowUps,
    });
  } catch (error: any) {
    console.error('Cron advance-sequences error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to advance sequences' },
      { status: 500 }
    );
  }
}
