/**
 * Sends a real test email FROM terrellgilb5@gmail.com TO support@sweetlease.io
 * simulating a prospect requesting an NDA/contract.
 *
 * Run: npx tsx scripts/send-test-contract-email.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local', override: true });

async function main() {
  const nodemailer = await import('nodemailer');

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.error('RESEND_API_KEY required in .env.local');
    process.exit(1);
  }

  // Use Resend SMTP to send — it supports any verified domain
  const transporter = nodemailer.default.createTransport({
    host: 'smtp.resend.com',
    port: 465,
    secure: true,
    auth: { user: 'resend', pass: resendKey },
  });

  await transporter.verify();
  console.log('SMTP connected.\n');

  const imapUser = process.env.IMAP_USER || 'support@sweetlease.io';

  // Send from outreach subdomain to the support inbox
  // The From header uses terrellgilb5@gmail.com so process-inbox matches the contact
  // Resend's verified domain (outreach.sweetlease.io) handles delivery
  const info = await transporter.sendMail({
    from: '"Terrell Gilbert" <test@outreach.sweetlease.io>',
    to: imapUser,
    subject: 'Re: SweetLease Partnership — NDA needed',
    text: [
      'Hi Robert,',
      '',
      'Thanks for the overview. This looks like a great fit for our relocating employees.',
      '',
      'Before we can move forward, our legal team requires an NDA and a service agreement. Can you send those over?',
      '',
      'Also, if you have any security documentation (SOC 2, data handling policies), that would be helpful for our procurement review.',
      '',
      'Looking forward to getting this started.',
      '',
      'Best,',
      'Terrell Gilbert',
      'terrellgilb5@gmail.com',
    ].join('\n'),
    replyTo: 'terrellgilb5@gmail.com',
    headers: {
      'X-Test': 'contract-flow-test',
    },
  });

  console.log(`Email sent to ${imapUser}`);
  console.log(`Message ID: ${info.messageId}`);
  console.log('\nNow wait ~30s for IMAP to receive it, then trigger:');
  console.log(`curl -s "https://locust-m7ng3.ondigitalocean.app/api/cron/process-inbox?secret=..."`);

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
