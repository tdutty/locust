import { config } from 'dotenv';
config({ path: '.env.local' });

import { Pool } from 'pg';

const connectionString = (process.env.DATABASE_URL || '').replace(/[?&]sslmode=[^&]*/g, '');
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

// Monday Feb 23, 2026, 12:30 PM CT = 18:30 UTC
const SCHEDULED_FOR = '2026-02-23T18:30:00Z';

// Email #1 templates by contact type
function generateEmail(contact: any): { subject: string; body: string; htmlBody: string } | null {
  const type = contact.contact_type;
  const name = contact.name || 'there';
  const org = contact.org_name || '';
  const city = contact.city || 'your area';

  let subject: string;
  let body: string;

  switch (type) {
    case 'employer':
      subject = `Employee housing placement - ${org || name}`;
      body = `Dear ${name},

My name is Terrell Gilbert with SweetLease. SweetLease is a rental listing and negotiation platform founded in 2026 with the goal of making renting more accessible. We provide a complimentary housing placement service for companies with relocating employees, handling the full search and lease negotiation process at no cost to your organization.

When ${org || 'your'} employees relocate, we connect them with pre-vetted, move-in ready properties before they hit the public market and negotiate lease terms on their behalf. Employees typically save $100-$300 per month on rent compared to searching independently.

What this means for your relocating workforce:
- Complimentary service - zero cost to ${org || 'your organization'}
- Access to quality rentals 2-3 weeks before public listing
- We negotiate lease terms on behalf of each employee
- Dedicated support throughout the entire leasing process
- We handle the full search, vetting, and placement end-to-end

Would it be helpful to explore this? I can walk through it in 15 minutes:
https://calendly.com/sweetlease/employer-intro

If a meeting does not work, I have attached a 2-page overview you can share with your team - takes 2 minutes to read.

Best regards,
Terrell Gilbert`;
      break;

    case 'residency':
      subject = `Housing resource for incoming ${org || 'program'} residents`;
      body = `Dear ${name},

My name is Terrell Gilbert with SweetLease. SweetLease is a rental listing and negotiation platform founded in 2026 with the goal of making renting more accessible. We work with residency programs to help incoming medical residents find quality housing near their clinical sites, negotiating lease terms on their behalf to secure below-market rates.

For ${org || 'your program'}, this means:
- Zero cost to the program, institution, and residents
- We negotiate lease terms on behalf of each resident, securing rates 15-25% below market average
- Furnished and unfurnished options from pre-screened, vetted landlords near ${org || 'your hospital'}
- End-to-end managed process: housing search, landlord vetting, negotiation, and placement
- Branded housing portal where incoming residents can browse available options
- Minimal administrative lift - your team shares the incoming cohort list, we handle everything else

Would 15 minutes work to walk through how it works?
https://calendly.com/sweetlease/university-partnership

If a call does not work with your schedule, I have attached a short overview you can share with your GME team.

Best regards,
Terrell Gilbert`;
      break;

    case 'university':
      subject = `Off-campus housing resource - ${org || 'your university'}`;
      body = `Dear ${name},

My name is Terrell Gilbert with SweetLease. SweetLease is a rental listing and negotiation platform founded in 2026 with the goal of making renting more accessible. We partner with universities to provide students with a curated housing resource, negotiating directly with landlords to secure rates well below what students would find on their own.

For ${org || 'your university'} students specifically:
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
Terrell Gilbert`;
      break;

    default:
      return null;
  }

  // Build HTML
  const htmlBody = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family:Arial,sans-serif;margin:0;padding:0;background-color:#ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:20px;">
    <tr><td>
      ${body.split('\n').map(line => {
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

  return { subject, body, htmlBody };
}

async function main() {
  // Fetch all eligible contacts
  const result = await pool.query(`
    SELECT id, name, email, contact_type, org_name, city, state
    FROM contacts
    WHERE status = 'new' AND email IS NOT NULL
    AND contact_type IN ('employer', 'residency', 'university')
    ORDER BY contact_type, id
  `);

  console.log(`Found ${result.rows.length} contacts to schedule\n`);

  let scheduled = 0;
  let skipped = 0;
  const byType: Record<string, number> = {};

  for (const contact of result.rows) {
    // Dedup: skip if already has a pending scheduled email
    const existing = await pool.query(
      `SELECT id FROM scheduled_emails WHERE to_email = $1 AND status = 'pending' LIMIT 1`,
      [contact.email]
    );
    if (existing.rows.length > 0) {
      skipped++;
      continue;
    }

    const email = generateEmail(contact);
    if (!email) continue;

    await pool.query(
      `INSERT INTO scheduled_emails (contact_id, to_email, subject, body, html_body, lead_type, scheduled_for)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [contact.id, contact.email, email.subject, email.body, email.htmlBody, contact.contact_type, SCHEDULED_FOR]
    );

    scheduled++;
    byType[contact.contact_type] = (byType[contact.contact_type] || 0) + 1;
  }

  console.log(`Scheduled: ${scheduled}`);
  console.log(`Skipped (already pending): ${skipped}`);
  console.log(`By type:`, byType);
  console.log(`\nAll scheduled for: Monday Feb 23, 2026 at 12:30 PM CT`);
  console.log(`The send-emails cron will pick these up automatically (10 per cycle, every 5 min).`);

  await pool.end();
  process.exit(0);
}

main();
