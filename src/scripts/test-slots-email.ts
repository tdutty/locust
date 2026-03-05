/**
 * One-off script: Send a test email with embedded Cal.com time slots.
 * Usage: npx tsx src/scripts/test-slots-email.ts
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import nodemailer from 'nodemailer';
import {
  fetchCalcomSlots,
  buildTimeSlotsHtml,
  buildTimeSlotsText,
  buildOutboundHtml,
} from '../lib/email-templates';

async function main() {
  console.log('Fetching Cal.com slots...');
  const slots = await fetchCalcomSlots();

  if (!slots) {
    console.error('No slots returned — check CALCOM_API_KEY');
    process.exit(1);
  }
  console.log(`Got ${slots.length} slots:`);
  for (const s of slots) console.log(`  ${s.date}  ${s.displayTime}`);

  // Send both Institutional and Platform Email 2 examples
  const institutionalBody = `Hi Donna,

Following up on my earlier note. I know Match season keeps your team busy, so I will be brief.

Every March, 40,000+ residents scramble to sign leases in cities they have never lived in, with deadlines they cannot control. Brokers charge $2,500 knowing residents have no alternative. Landlords price above market knowing they will not push back. That is $5,000-$8,000 in avoidable costs per resident before training even starts.

SweetLease flips that dynamic. We aggregate residents as a tenant bloc and negotiate directly with verified landlords — eliminating broker fees, securing below-market rents, and completing placements in 7-14 days.

NRMP pays nothing. Residents pay nothing. With a 5-minute tutorial I can show you exactly how it works and address any questions you have.

Best,
Terrell Gilbert`;

  const platformBody = `Hi Bob,

Following up on my earlier note. I know Match season keeps your team busy, so I will be brief.

Every March, 40,000+ residents scramble to sign leases in cities they have never lived in, with deadlines they cannot control. Brokers charge $2,500 knowing residents have no alternative. Landlords price above market knowing they will not push back. That is $5,000-$8,000 in avoidable costs per resident before training even starts.

SweetLease flips that dynamic. We aggregate residents as a tenant bloc and negotiate directly with verified landlords — eliminating broker fees, securing below-market rents, and completing placements in 7-14 days.

Doximity pays nothing. Residents pay nothing. With a 5-minute tutorial I can show you exactly how it works and address any questions you have.

Best,
Terrell Gilbert`;

  const slotsHtml = buildTimeSlotsHtml(slots);

  function buildEmail(body: string) {
    let html = buildOutboundHtml(body);
    html = html.replace(
      '<div style="border-top:1px solid #e2e8f0;padding-top:16px;margin-top:4px;">',
      `${slotsHtml}<div style="border-top:1px solid #e2e8f0;padding-top:16px;margin-top:4px;">`
    );
    return html;
  }

  // Send via Porkbun SMTP
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASSWORD;
  if (!smtpUser || !smtpPass) {
    console.error('SMTP_USER/SMTP_PASSWORD not set');
    process.exit(1);
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.porkbun.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: { user: smtpUser, pass: smtpPass },
  });

  await transporter.verify();
  console.log('SMTP connected. Sending both...');

  const info1 = await transporter.sendMail({
    from: `"Robert Gilbert" <${smtpUser}>`,
    replyTo: 'rgilbert@sweetlease.io',
    to: 'terrellgilb5@gmail.com',
    subject: '[Institutional] Following up - resident housing costs',
    text: institutionalBody,
    html: buildEmail(institutionalBody),
  });
  console.log(`Institutional sent: ${info1.messageId}`);

  const info2 = await transporter.sendMail({
    from: `"Robert Gilbert" <${smtpUser}>`,
    replyTo: 'rgilbert@sweetlease.io',
    to: 'terrellgilb5@gmail.com',
    subject: '[Platform] Following up - resident housing costs',
    text: platformBody,
    html: buildEmail(platformBody),
  });
  console.log(`Platform sent: ${info2.messageId}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
