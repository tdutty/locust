import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

// Porkbun email configuration
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.porkbun.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'tgilbert@sweetlease.io',
    pass: process.env.SMTP_PASSWORD || 'fotma2-pastaZ-jimwip',
  },
});

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

    // Verify connection
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
      from: `"Terrell Gilbert" <${process.env.SMTP_USER || 'tgilbert@sweetlease.io'}>`,
      to,
      subject,
      text: emailBody,
      html: htmlBody,
    });

    console.log('Email sent:', {
      messageId: info.messageId,
      to,
      subject,
      leadId,
      leadType,
      timestamp: new Date().toISOString(),
    });

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
