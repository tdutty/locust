import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import {
  generateWithAI,
  getSequenceForType,
  getMaxSteps,
  buildOutboundHtml,
  calculateNextBusinessDay,
  LeadInfo,
} from '@/lib/email-templates';

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

        // Build HTML
        const htmlBody = buildOutboundHtml(emailContent.body);

        // Schedule email for immediate pickup by send-emails cron
        await query(
          `INSERT INTO scheduled_emails (contact_id, to_email, subject, body, html_body, lead_type, scheduled_for)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [seq.contact_id, seq.email, emailContent.subject, emailContent.body, htmlBody, contactType]
        );

        // Update sequence
        const nextSendAt = calculateNextBusinessDay(new Date(), 4);
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

    return NextResponse.json({
      processed: result.rows.length,
      advanced,
      stopped,
      completed,
    });
  } catch (error: any) {
    console.error('Cron advance-sequences error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to advance sequences' },
      { status: 500 }
    );
  }
}
