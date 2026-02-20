import { config } from 'dotenv';
config({ path: '.env.local' });

import nodemailer from 'nodemailer';
import Anthropic from '@anthropic-ai/sdk';

const TO = 'terrellgilb5@gmail.com';

// Use templates directly (same as generate route)
const demos = [
  {
    type: 'landlord',
    subject: 'How to compete with corporate landlords',
    body: `Dear Sarah Mitchell,

My name is Terrell Gilbert with SweetLease, and I am reaching out regarding an opportunity to connect your Austin properties with relocating corporate tenants.

Independent landlords are competing with corporate property managers who have dedicated sales teams reaching relocating employees before those tenants ever hit Zillow or Apartments.com. SweetLease levels that playing field.

We partner with HR departments at companies relocating employees to Austin. When their employees need housing, we match them with landlords like you first. These are W-2 employed, pre-screened tenants ready to sign quickly at competitive rates.

Key benefits for your portfolio:
- Fill vacancies in 14 days on average, compared to 45 days on traditional platforms
- Pre-screened tenants with employer-backed lease guarantees
- You maintain final say on pricing and tenant approval
- Our commission is 25% below the industry standard
- We integrate your existing listings at no additional cost

Would it be helpful to explore this? I can walk through it in a brief call:
https://calendly.com/sweetlease/intro

If a call is not ideal right now, I have attached a one-pager that covers how it works for landlords in your market — takes 2 minutes to read.

Best regards,
Terrell Gilbert`,
  },
  {
    type: 'employer',
    subject: 'Housing support for relocating Tesla employees',
    body: `Dear Tesla HR,

My name is Terrell Gilbert with SweetLease, and I am reaching out regarding housing support for your relocating employees.

SweetLease is a complimentary housing placement service designed to reduce relocation friction. When your employees need housing in a new city, we connect them with pre-vetted, move-in ready properties before they hit the public market — at zero cost to Tesla.

What this means for your relocating workforce:
- Employees save $100–$300 per month on rent compared to searching independently
- Access to quality rentals 2–3 weeks before public listing
- Pre-negotiated lease terms with flexible options
- Dedicated support throughout the entire leasing process
- We handle the full search, vetting, and placement end-to-end

This service is entirely free for your organization. We simply want to be a resource your HR team can offer to employees during the relocation process.

Would it be helpful to explore this? I can walk through it in 15 minutes:
https://calendly.com/sweetlease/employer-intro

If a meeting does not work, I have attached a 2-page overview you can share with your team — takes 2 minutes to read.

Best regards,
Terrell Gilbert`,
  },
  {
    type: 'residency',
    subject: 'Housing support for incoming residents at Memorial Hermann',
    body: `Dear Dr. James Rivera,

My name is Terrell Gilbert with SweetLease, and I am reaching out regarding housing support for your incoming medical residents.

SweetLease is a free, fully managed housing service built specifically for residency programs. We help incoming residents find quality, affordable housing by negotiating lease terms on their behalf — securing rates 15–25% below market average.

Here is what the service includes for your program:
- Zero cost to the institution and to the residents
- Lease negotiation on behalf of each resident to secure below-market rates
- Furnished and unfurnished options from pre-screened, vetted landlords
- Proximity matching — we prioritize housing near clinical sites and hospitals
- End-to-end managed process: housing search, landlord vetting, negotiation, and placement
- A branded housing portal where incoming residents can browse available options
- Ongoing support throughout the lease term, not just at placement

Your team would simply share the incoming cohort list — we handle everything else from there. The administrative lift on your end is minimal.

Would 15 minutes work to walk through how this would look for your program?
https://calendly.com/sweetlease/university-partnership

If a call does not work with your schedule, I have attached a short overview you can share with your GME team.

Best regards,
Terrell Gilbert`,
  },
  {
    type: 'university',
    subject: 'Free housing resource for UT Austin students',
    body: `Dear Professor Chen,

My name is Terrell Gilbert with SweetLease, and I am reaching out regarding a free housing resource for your students.

SweetLease helps students find quality off-campus housing at rates 15–25% below market average. We negotiate directly with landlords on behalf of students, using collective demand to secure better lease terms — similar to how group buying works in other industries.

For your students specifically:
- Curated, pre-vetted housing options near campus
- Furnished and unfurnished options matched to student needs
- We negotiate lease terms on their behalf, securing $100–$250 below market rate
- No credit history required — we use alternative verification for international students
- Dedicated support throughout the lease term

There is zero cost to the university. We are simply a resource your housing office can recommend to students, particularly incoming freshmen, transfer students, and international students who face the biggest housing challenges.

Would you be open to a 15-minute call to discuss how this could work for UT Austin?
https://calendly.com/sweetlease/university-partnership

If a call is not ideal right now, I have attached a one-pager you can share with your team — takes 2 minutes to read.

Best regards,
Terrell Gilbert`,
  },
  {
    type: 'benefits-platform',
    subject: 'New LSA category your clients are asking about',
    body: `Dear Benefits Team,

My name is Terrell Gilbert with SweetLease, and I am reaching out because your platform is one of the leaders in employee benefits, and we have built something that fits naturally into your marketplace.

SweetLease is a housing benefit. Employees who rent — especially those relocating — get access to group-negotiated rent discounts that save $100–$300 per month. It works like a buying group for housing.

For your platform, this means:
- A new benefit category that no other LSA or benefits platform offers yet
- High engagement — housing is a top-3 expense for every employee
- Simple integration — we handle the negotiation, your platform gets a new category
- Zero cost to integrate — we handle all landlord relationships and negotiation

We are looking for one benefits platform partner to launch with. Given your position in the market, you would be first to offer this category.

Would 20 minutes work to explore the partnership model?
https://calendly.com/sweetlease/employer-intro

If a meeting does not make sense yet, I have attached a short deck on the integration model.

Best regards,
Terrell Gilbert`,
  },
];

async function main() {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.porkbun.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASSWORD! },
  });

  await transporter.verify();
  console.log('SMTP connected\n');

  for (const demo of demos) {
    try {
      const htmlBody = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family:Arial,sans-serif;margin:0;padding:0;background-color:#ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:20px;">
    <tr><td>
      ${demo.body.split('\n').map(line => {
        if (!line.trim()) return '';
        if (line.includes('https://')) {
          const url = line.trim().match(/https?:\/\/\S+/)?.[0] || line.trim();
          return `<p style="margin:10px 0;font-size:15px;line-height:1.6;color:#333;"><a href="${url}" style="color:#EA580C;text-decoration:none;">${url}</a></p>`;
        }
        if (line.trim().startsWith('- ')) {
          return `<p style="margin:4px 0 4px 16px;font-size:15px;line-height:1.6;color:#333;">&#8226; ${line.trim().slice(2)}</p>`;
        }
        return `<p style="margin:10px 0;font-size:15px;line-height:1.6;color:#333;">${line}</p>`;
      }).join('')}
      <table cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;border-top:1px solid #e2e8f0;padding-top:16px;">
        <tr><td style="vertical-align:top;font-family:Arial,sans-serif;">
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
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

      await transporter.sendMail({
        from: `"Terrell Gilbert" <${process.env.SMTP_USER}>`,
        to: TO,
        subject: `SweetLease Outbound [${demo.type.toUpperCase()}] — ${demo.subject}`,
        text: demo.body,
        html: htmlBody,
      });

      console.log(`SENT: [${demo.type.toUpperCase()}] ${demo.subject}`);
    } catch (err) {
      console.error(`FAIL: [${demo.type.toUpperCase()}]`, err);
    }
  }

  console.log('\nDone!');
  process.exit(0);
}

main();
