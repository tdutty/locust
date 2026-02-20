import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { query } from '@/lib/db';

function getTransporter() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!user || !pass) {
    throw new Error('SMTP_USER and SMTP_PASSWORD environment variables are required');
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
        const htmlBody = email.html_body || `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
    p { margin: 10px 0; }
    a { color: #16a34a; }
  </style>
</head>
<body>
  ${email.body.split('\n').map((line: string) =>
    line.includes('https://')
      ? `<p><a href="${line.trim()}">${line.trim()}</a></p>`
      : line ? `<p>${line}</p>` : '<br>'
  ).join('')}
</body>
</html>
`;

        const info = await transporter.sendMail({
          from: `"Terrell Gilbert" <${process.env.SMTP_USER}>`,
          to: email.to_email,
          subject: email.subject,
          text: email.body,
          html: htmlBody,
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
