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

    // Create HTML version with email signature
    const bodyHtml = emailBody.split('\n').map((line: string) => {
      if (line.includes('https://')) {
        const url = line.trim();
        return `<p><a href="${url}" style="color:#dc2626;text-decoration:none;">${url}</a></p>`;
      }
      if (line.startsWith('•') || line.startsWith('-')) {
        return `<p style="margin:4px 0 4px 16px;">${line}</p>`;
      }
      return line ? `<p>${line}</p>` : '<br>';
    }).join('');

    const signature = `
<table cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;border-top:1px solid #e2e8f0;padding-top:16px;">
  <tr>
    <td style="vertical-align:top;font-family:Arial,sans-serif;">
      <p style="margin:0 0 8px 0;font-size:20px;font-weight:700;letter-spacing:-0.02em;line-height:1;">
        <span style="color:#EA580C;">SWEET</span><span style="color:#1a1a1a;">LEASE</span>
      </p>
      <p style="margin:0;font-size:14px;font-weight:600;color:#1a1a1a;">Terrell Gilbert</p>
      <p style="margin:2px 0 0;font-size:12px;color:#64748b;">Account Executive</p>
      <p style="margin:6px 0 0;font-size:12px;">
        <a href="https://sweetlease.io" style="color:#EA580C;text-decoration:none;">sweetlease.io</a>
        <span style="color:#cbd5e1;margin:0 6px;">|</span>
        <a href="mailto:tgilbert@sweetlease.io" style="color:#EA580C;text-decoration:none;">tgilbert@sweetlease.io</a>
      </p>
    </td>
  </tr>
</table>`;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
    p { margin: 10px 0; }
  </style>
</head>
<body>
  ${bodyHtml}
  ${signature}
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
      await query(`
        INSERT INTO email_log (to_email, subject, body, lead_id, lead_type, message_id)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [to, subject, emailBody, leadId || null, leadType || null, info.messageId]);
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
