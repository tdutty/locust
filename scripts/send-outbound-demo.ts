import { config } from 'dotenv';
config({ path: '.env.local' });

import nodemailer from 'nodemailer';

const TO = 'terrellgilb5@gmail.com';

const demos = [
  {
    type: 'landlord',
    subject: 'Corporate relocation tenants in Austin',
    body: `Dear Sarah Mitchell,

My name is Terrell Gilbert with SweetLease. SweetLease is a rental listing platform founded in 2026 with the goal of making renting more accessible. We connect property managers with pre-screened, employer-backed tenants who are actively relocating and ready to sign.

We partner with HR departments at companies relocating employees to Austin. When their employees need housing, we match them with property managers like you first.

These are W-2 employed, pre-screened tenants backed by their employers, ready to sign at competitive rates. We deliver tenant signings in bulk, and our partners are averaging 14-day fills compared to 45 days on traditional platforms. Our commission is 25% below the industry standard.

You maintain final say on pricing and tenant approval. We integrate your existing listings at no additional cost and the onboarding process is quick.

Would it be helpful to explore this? I can walk through it in 15 minutes:
https://calendly.com/sweetlease/intro

If a call is not ideal right now, I have attached a one-pager that covers how it works - takes 2 minutes to read.

Best regards,
Terrell Gilbert`,
  },
  {
    type: 'employer',
    subject: 'Employee housing placement - Forma',
    body: `Dear Lisa Park,

My name is Terrell Gilbert with SweetLease. SweetLease is a rental listing and negotiation platform founded in 2026 with the goal of making renting more accessible. We provide a complimentary housing placement service for companies with relocating employees, handling the full search and lease negotiation process at no cost to your organization.

When Forma employees relocate, we connect them with pre-vetted, move-in ready properties before they hit the public market and negotiate lease terms on their behalf. Employees typically save $100-$300 per month on rent compared to searching independently.

What this means for your relocating workforce:
- Complimentary service - zero cost to Forma
- Access to quality rentals 2-3 weeks before public listing
- We negotiate lease terms on behalf of each employee
- Dedicated support throughout the entire leasing process
- We handle the full search, vetting, and placement end-to-end

Would it be helpful to explore this? I can walk through it in 15 minutes:
https://calendly.com/sweetlease/employer-intro

If a meeting does not work, I have attached a 2-page overview you can share with your team - takes 2 minutes to read.

Best regards,
Terrell Gilbert`,
  },
  {
    type: 'residency',
    subject: 'Housing resource for incoming Mount Sinai residents',
    body: `Dear Sarah Mitchell,

My name is Terrell Gilbert with SweetLease. SweetLease is a rental listing and negotiation platform founded in 2026 with the goal of making renting more accessible. We work with residency programs to help incoming medical residents find quality housing near their clinical sites, negotiating lease terms on their behalf to secure below-market rates.

For Mount Sinai Health System, this means:
- Zero cost to the program, institution, and residents
- We negotiate lease terms on behalf of each resident, securing rates 15-25% below market average
- Furnished and unfurnished options from pre-screened, vetted landlords near Mount Sinai
- End-to-end managed process: housing search, landlord vetting, negotiation, and placement
- Branded housing portal where incoming residents can browse available options
- Minimal administrative lift - your team shares the incoming cohort list, we handle everything else

Would 15 minutes work to walk through how it works?
https://calendly.com/sweetlease/university-partnership

If a call does not work with your schedule, I have attached a short overview you can share with your GME team.

Best regards,
Terrell Gilbert`,
  },
  {
    type: 'university',
    subject: 'Off-campus housing resource - Columbia University',
    body: `Dear Marcus Thompson,

My name is Terrell Gilbert with SweetLease. SweetLease is a rental listing and negotiation platform founded in 2026 with the goal of making renting more accessible. We partner with universities to provide students with a curated housing resource, negotiating directly with landlords to secure rates well below what students would find on their own.

For Columbia University students specifically:
- Zero cost to the university and to students
- We negotiate lease terms on behalf of students, securing rates 15-25% below market average
- Curated, pre-vetted housing options near campus - furnished and unfurnished
- Especially valuable for incoming freshmen, transfer students, and international students
- Branded housing portal for your program where students can browse options

There is zero cost to the university. We are simply a resource your housing office can recommend to students.

Would you be open to a 15-minute call?
https://calendly.com/sweetlease/university-partnership

If a call is not ideal right now, I have attached a one-pager you can share with your team - takes 2 minutes to read.

Best regards,
Terrell Gilbert`,
  },
  {
    type: 'benefits-platform',
    subject: 'Housing as an employee benefit - Benepass',
    body: `Dear Michael Okafor,

My name is Terrell Gilbert with SweetLease. SweetLease is a rental listing and negotiation platform founded in 2026 with the goal of making renting more accessible. We aggregate renter demand by geography and negotiate group rates with landlords, creating a housing benefit that fits naturally into employee benefits marketplaces.

For Benepass, this means:
- A new benefit category that no other LSA or benefits platform offers yet
- High engagement - housing is a top-3 expense for every employee
- Simple integration - we handle all negotiation and landlord relationships
- Employees save $100-$300 per month on rent through group negotiation

We are looking for one benefits platform partner to launch with. Given Benepass's position in the market, you would be first to offer this category.

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
        subject: `SweetLease Outbound [${demo.type.toUpperCase()}] - ${demo.subject}`,
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
