import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { getDb } from '@/lib/db';

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, subject, body: emailBody, leadId, leadType } = body;

    if (!to || !subject || !emailBody) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const transporter = getTransporter();
    await transporter.verify();

    // Create HTML version
    const htmlBody = `
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
  ${emailBody.split('\n').map((line: string) =>
    line.includes('https://')
      ? `<p><a href="${line.trim()}">${line.trim()}</a></p>`
      : line ? `<p>${line}</p>` : '<br>'
  ).join('')}
</body>
</html>
`;

    // Send email
    const info = await transporter.sendMail({
      from: `"Terrell Gilbert" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text: emailBody,
      html: htmlBody,
    });

    // Log to database
    try {
      const db = getDb();
      db.prepare(`
        INSERT INTO email_log (to_email, subject, body, lead_id, lead_type, message_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(to, subject, emailBody, leadId || null, leadType || null, info.messageId);
    } catch (dbErr) {
      console.error('Failed to log email to database:', dbErr);
    }

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
    });
  } catch (error: any) {
    console.error('Email send error:', error);

    return NextResponse.json(
      { error: error.message || 'Failed to send email' },
      { status: 500 }
    );
  }
}
