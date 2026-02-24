import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { query } from '@/lib/db';
import { wrapLinksForTracking } from '@/lib/link-tracking';
import { getMaxSteps, calculateNextBusinessDay, buildOutboundHtml } from '@/lib/email-templates';

// Outbound cold emails use Resend SMTP (outreach.sweetlease.io subdomain)
// Replies/inbox emails still use Porkbun (rgilbert@sweetlease.io)
function getTransporter() {
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    return nodemailer.createTransport({
      host: 'smtp.resend.com',
      port: 465,
      secure: true,
      auth: { user: 'resend', pass: resendKey },
    });
  }
  // Fallback to Porkbun if Resend not configured
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!user || !pass) {
    throw new Error('RESEND_API_KEY or SMTP_USER/SMTP_PASSWORD required');
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.porkbun.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: { user, pass },
  });
}

function validateCronAuth(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  // Bearer token (matches sweetlease worker.js pattern)
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ') && authHeader.slice(7) === cronSecret) {
    return true;
  }

  // Query param fallback for manual testing
  const { searchParams } = new URL(request.url);
  return searchParams.get('secret') === cronSecret;
}

export async function GET(request: NextRequest) {
  if (!validateCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch up to 10 due emails
    const result = await query(
      `SELECT * FROM scheduled_emails
       WHERE status = 'pending' AND scheduled_for <= NOW()
       ORDER BY scheduled_for ASC
       LIMIT 10`
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ processed: 0, message: 'No emails due' });
    }

    const transporter = getTransporter();
    await transporter.verify();

    let sent = 0;
    let failed = 0;

    for (const email of result.rows) {
      try {
        const htmlBody = email.html_body || buildOutboundHtml(email.body);

        // Wrap links for click tracking
        let trackedHtml = await wrapLinksForTracking(htmlBody, email.contact_id, email.id);

        // Inject instant meeting link for contacts with a contact_id
        if (email.contact_id) {
          const meetingUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://locust-m7ng3.ondigitalocean.app'}/api/meeting/book-link/${email.contact_id}`;
          const meetingCta = `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#1a1a1a;">Or, skip the scheduling \u2014 <a href="${meetingUrl}" style="color:#EA580C;text-decoration:none;font-weight:600;">talk to our team now</a> (instant video call).</p>`;
          // Insert before the signature divider
          trackedHtml = trackedHtml.replace(
            '<div style="border-top:1px solid #e2e8f0;padding-top:16px;margin-top:4px;">',
            `${meetingCta}<div style="border-top:1px solid #e2e8f0;padding-top:16px;margin-top:4px;">`
          );
        }

        const fromAddress = process.env.RESEND_API_KEY
          ? '"Robert Gilbert" <rgilbert@outreach.sweetlease.io>'
          : `"Robert Gilbert" <${process.env.SMTP_USER}>`;

        const info = await transporter.sendMail({
          from: fromAddress,
          replyTo: 'rgilbert@sweetlease.io',
          to: email.to_email,
          subject: email.subject,
          text: email.body,
          html: trackedHtml,
          headers: {
            'List-Unsubscribe': '<mailto:rgilbert@sweetlease.io?subject=Unsubscribe>',
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        });

        // Mark as sent
        await query(
          `UPDATE scheduled_emails SET status = 'sent', message_id = $1, sent_at = NOW() WHERE id = $2`,
          [info.messageId, email.id]
        );

        // Log to email_log
        try {
          await query(
            `INSERT INTO email_log (to_email, subject, body, lead_id, lead_type, message_id)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [email.to_email, email.subject, email.body, email.lead_id, email.lead_type, info.messageId]
          );
        } catch (logErr) {
          console.error('Failed to log scheduled email:', logErr);
        }

        // Create follow-up sequence if this is Email #1 for this contact
        if (email.contact_id && email.lead_type) {
          try {
            const existingSeq = await query(
              'SELECT id FROM contact_sequences WHERE contact_id = $1 LIMIT 1',
              [email.contact_id]
            );
            if (existingSeq.rows.length === 0) {
              const maxSteps = getMaxSteps(email.lead_type);
              const nextSendAt = calculateNextBusinessDay(new Date(), 4);
              await query(
                `INSERT INTO contact_sequences (contact_id, contact_type, current_step, max_steps, last_sent_at, next_send_at)
                 VALUES ($1, $2, 1, $3, NOW(), $4)`,
                [email.contact_id, email.lead_type, maxSteps, nextSendAt.toISOString()]
              );
            }
          } catch (seqErr) {
            console.error('Failed to create sequence:', seqErr);
          }
        }

        sent++;
      } catch (sendErr: any) {
        // Mark as failed with error
        await query(
          `UPDATE scheduled_emails SET status = 'failed', error = $1 WHERE id = $2`,
          [sendErr.message || 'Unknown error', email.id]
        );
        failed++;
      }
    }

    return NextResponse.json({
      processed: result.rows.length,
      sent,
      failed,
    });
  } catch (error: any) {
    console.error('Cron send-emails error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process scheduled emails' },
      { status: 500 }
    );
  }
}
