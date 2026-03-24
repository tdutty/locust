/**
 * Schedule staggered outreach for ALL contact types.
 *
 * Two actions:
 *   1. Reschedule 408 parked emails (employer/residency/university at 2099-01-01)
 *      with real staggered send times.
 *   2. Create new Email #1 for landlord contacts (and any others) with no
 *      scheduled email at all.
 *
 * Ramp-up schedule (business days only):
 *   Day 1:  50 emails  (warm-up)
 *   Day 2:  75
 *   Day 3: 100
 *   Day 4+: 100/day until all contacts are covered
 *
 * Within each day, emails are spread across 9 AM – 4 PM CT (15:00–22:00 UTC)
 * with randomised intervals so they look organic.
 *
 * Contact types are interleaved (shuffled) so no single type dominates a day.
 *
 * Run:  npx tsx scripts/schedule-outreach-release.ts [--dry-run]
 */

import { config } from 'dotenv';
config({ path: '.env.local', override: true });

import { Pool } from 'pg';

const connectionString = (process.env.DATABASE_URL || '').replace(/[?&]sslmode=[^&]*/g, '');
const isRemote = connectionString.includes('ondigitalocean.com') || process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString,
  ssl: isRemote ? { rejectUnauthorized: false } : undefined,
  max: 3,
  idleTimeoutMillis: 10000,
});

// ─── Templates (inline, matches email-templates.ts) ────────────────────────

interface Contact {
  id: number;
  name: string;
  email: string;
  contact_type: string;
  org_name: string;
  city: string;
  state: string;
  title: string;
  org_employee_count: number;
}

function getEmail1(c: Contact): { subject: string; body: string } {
  const ct = c.contact_type;

  if (ct === 'landlord') {
    return {
      subject: `Corporate relocation tenants in ${c.city || 'your area'}`,
      body: `Dear ${c.name},

My name is Robert Gilbert with SweetLease. Every vacant unit costs you roughly $60/day. The average independent landlord in ${c.city || 'your market'} waits 30-45 days to fill a vacancy — that's $1,800-$2,700 in lost rent per turn.

SweetLease cuts that to 14 days by connecting you with pre-screened, employer-backed tenants who are actively relocating and ready to sign.

We partner with HR departments at companies moving employees to ${c.city || 'your area'}. When their employees need housing, we match them with property managers like you first. These are W-2 employed tenants backed by their employers, ready to sign at competitive rates. Our commission is 25% below the industry standard.

You maintain final say on pricing and tenant approval. We integrate your existing listings at no additional cost.

Would it be helpful to explore this? I can walk through it in 15 minutes.

If a call is not ideal right now, I have attached a one-pager that covers how it works - takes 2 minutes to read.

Best regards,
Robert Gilbert`,
    };
  }

  if (ct === 'employer') {
    return {
      subject: `Employee housing placement - ${c.org_name || 'your organization'}`,
      body: `Dear ${c.name || 'there'},

My name is Robert Gilbert with SweetLease. Relocating employees spend an average of 6 weeks finding housing — delaying start dates, burning through temporary housing budgets, and starting their new role stressed.

SweetLease eliminates that. When ${c.org_name || 'your'} employees relocate, we connect them with pre-vetted, move-in ready properties before they hit the public market and negotiate lease terms on their behalf. Employees typically save $100-$300 per month on rent, and average time to placed housing drops from 45 days to 14.

What this means for your relocating workforce:
- Complimentary service - zero cost to ${c.org_name || 'your organization'}
- Access to quality rentals 2-3 weeks before public listing
- We negotiate lease terms on behalf of each employee
- Dedicated support throughout the entire leasing process
- We handle the full search, vetting, and placement end-to-end

Would it be helpful to explore this? I can walk through it in 15 minutes.

If a meeting does not work, I have attached a 2-page overview you can share with your team - takes 2 minutes to read.

Best regards,
Robert Gilbert`,
    };
  }

  if (ct === 'university' || ct === 'graduate-housing') {
    return {
      subject: `Off-campus housing resource - ${c.org_name || 'your university'}`,
      body: `Dear ${c.name || 'there'},

My name is Robert Gilbert with SweetLease. Off-campus rents near ${c.org_name || 'your campus'} have climbed 12-15% year-over-year, and students are bearing the full burden. SweetLease gives your housing office a free tool to fight back.

We negotiate directly with landlords on behalf of students, using group demand to secure rates 15-25% below market. For ${c.org_name || 'your university'} students specifically:
- Zero cost to the university and to students
- We negotiate lease terms on behalf of students, securing rates 15-25% below market average
- Curated, pre-vetted housing options near campus - furnished and unfurnished
- Especially valuable for incoming freshmen, transfer students, and international students
- Branded housing portal for your program where students can browse options

There is zero cost to the university. We are simply a resource your housing office can recommend to students.

Would you be open to a 15-minute call?
If a call is not ideal right now, I have attached a one-pager you can share with your team - takes 2 minutes to read.

Best regards,
Robert Gilbert`,
    };
  }

  // residency
  return {
    subject: `Housing resource for incoming ${c.org_name || 'program'} residents`,
    body: `Dear ${c.name || 'there'},

My name is Robert Gilbert with SweetLease. A PGY-1 making $60-65K is spending 40-50% of gross income on rent in most metro areas. For programs competing for top candidates, that's a recruitment and retention problem hiding in plain sight.

SweetLease solves it at zero cost to your program. We help incoming residents find quality housing near their clinical sites, negotiating lease terms to secure rates 15-25% below market. For ${c.org_name || 'your program'}, this means:
- Zero cost to the program, institution, and residents
- We negotiate lease terms on behalf of each resident, securing rates 15-25% below market average
- Furnished and unfurnished options from pre-screened, vetted landlords near ${c.org_name || 'your hospital'}
- End-to-end managed process: housing search, landlord vetting, negotiation, and placement
- Branded housing portal where incoming residents can browse available options
- Minimal administrative lift - your team shares the incoming cohort list, we handle everything else

Would 15 minutes work to walk through how it works?
If a call does not work with your schedule, I have attached a short overview you can share with your GME team.

Best regards,
Robert Gilbert`,
  };
}

// ─── HTML builder (matches buildOutboundHtml) ──────────────────────────────

function buildHtml(body: string): string {
  const lines = body.split('\n').map(line => {
    if (!line.trim()) return '';
    if (line.trim().startsWith('- ')) {
      return `<p style="margin:0 0 4px;padding-left:12px;font-size:15px;line-height:1.7;color:#333;">\u2022 ${line.trim().slice(2)}</p>`;
    }
    if (line.trim() === 'Best regards,') {
      return `<p style="margin:0 0 2px;font-size:15px;line-height:1.7;color:#1a1a1a;">Best regards,</p>`;
    }
    if (line.trim() === 'Robert Gilbert') {
      return `<p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#1a1a1a;"><strong>Robert Gilbert</strong></p>`;
    }
    return `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#1a1a1a;">${line}</p>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#ffffff;">
  <div style="max-width:580px;margin:0 auto;padding:24px 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#1a1a1a;">
    ${lines}
    <div style="border-top:1px solid #e2e8f0;padding-top:16px;margin-top:4px;">
      <p style="margin:0 0 6px;font-size:18px;font-weight:700;letter-spacing:-0.01em;">
        <span style="color:#EA580C;">SWEET</span><span style="color:#1a1a1a;">LEASE</span>
      </p>
      <p style="margin:0;font-size:13px;color:#64748b;">Account Executive</p>
      <p style="margin:6px 0 0;font-size:13px;">
        <a href="https://sweetlease.io" style="color:#EA580C;text-decoration:none;">sweetlease.io</a>
        <span style="color:#cbd5e1;margin:0 4px;">\u00b7</span>
        <a href="mailto:rgilbert@sweetlease.io" style="color:#EA580C;text-decoration:none;">rgilbert@sweetlease.io</a>
      </p>
    </div>
    <p style="margin:20px 0 0;font-size:11px;color:#94a3b8;">
      If you no longer wish to receive these emails, <a href="mailto:rgilbert@sweetlease.io?subject=Unsubscribe" style="color:#94a3b8;text-decoration:underline;">unsubscribe</a>.
    </p>
  </div>
</body>
</html>`;
}

// ─── Stagger logic ─────────────────────────────────────────────────────────

function nextBusinessDay(from: Date, n: number): Date {
  const d = new Date(from);
  let added = 0;
  while (added < n) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) added++;
  }
  return d;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate N staggered timestamps starting tomorrow.
 * Ramp: day1=50, day2=75, day3+=100.
 * Each day spread across 9 AM – 4 PM CT.
 */
function generateSendTimes(count: number): Date[] {
  const ramp = [50, 75];
  const dailyCap = (day: number) => (day < ramp.length ? ramp[day] : 100);
  const today = new Date();
  const times: Date[] = [];
  let dayIndex = 0;
  let sentToday = 0;

  for (let i = 0; i < count; i++) {
    if (sentToday >= dailyCap(dayIndex)) {
      dayIndex++;
      sentToday = 0;
    }
    const sendDate = nextBusinessDay(today, dayIndex + 1);
    const minuteOffset = randInt(0, 419);
    sendDate.setUTCHours(15, 0, 0, 0);
    sendDate.setMinutes(sendDate.getMinutes() + minuteOffset);
    times.push(sendDate);
    sentToday++;
  }

  return times;
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log(dryRun ? '\n=== DRY RUN — nothing will be modified ===\n' : '\n=== LIVE RUN — scheduling emails ===\n');

  // ── Part 1: Find parked emails (scheduled_for >= 2090) ──────────────────
  const parkedResult = await pool.query(`
    SELECT se.id, se.to_email, se.lead_type, se.contact_id
    FROM scheduled_emails se
    WHERE se.status = 'pending'
      AND se.scheduled_for >= '2090-01-01'
    ORDER BY se.id ASC
  `);
  const parkedEmails = parkedResult.rows;

  // ── Part 2: Find contacts needing new emails (exclude landlords) ──────
  const newResult = await pool.query(`
    SELECT c.id, c.name, c.email, c.contact_type, c.org_name, c.city, c.state, c.title, c.org_employee_count
    FROM contacts c
    WHERE c.status = 'new'
      AND c.contact_type IN ('employer', 'university', 'residency', 'benefits-platform', 'graduate-housing')
      AND c.email IS NOT NULL
      AND c.email_status = 'verified'
      AND NOT EXISTS (SELECT 1 FROM contact_sequences cs WHERE cs.contact_id = c.id)
      AND NOT EXISTS (SELECT 1 FROM email_log el WHERE el.to_email = c.email)
      AND NOT EXISTS (SELECT 1 FROM scheduled_emails se WHERE se.to_email = c.email AND se.status IN ('pending', 'sent'))
    ORDER BY c.id ASC
  `);
  const newContacts: Contact[] = newResult.rows;

  const totalItems = parkedEmails.length + newContacts.length;

  console.log(`Part 1: ${parkedEmails.length} parked emails to reschedule (at 2099-01-01)`);
  const parkedByType: Record<string, number> = {};
  for (const e of parkedEmails) {
    parkedByType[e.lead_type || 'unknown'] = (parkedByType[e.lead_type || 'unknown'] || 0) + 1;
  }
  for (const [type, count] of Object.entries(parkedByType).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type}: ${count}`);
  }

  console.log(`\nPart 2: ${newContacts.length} contacts needing new Email #1`);
  const newByType: Record<string, number> = {};
  for (const c of newContacts) {
    newByType[c.contact_type || 'unknown'] = (newByType[c.contact_type || 'unknown'] || 0) + 1;
  }
  for (const [type, count] of Object.entries(newByType).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type}: ${count}`);
  }

  console.log(`\nTotal: ${totalItems} emails to schedule across all types\n`);

  if (totalItems === 0) {
    console.log('Nothing to do. Exiting.');
    process.exit(0);
  }

  // ── Generate staggered times for ALL items combined ─────────────────────
  // Shuffle parked + new together so types are interleaved across days
  const allItems: { type: 'parked' | 'new'; parkedId?: number; contact?: Contact; leadType: string }[] = [];

  for (const e of parkedEmails) {
    allItems.push({ type: 'parked', parkedId: e.id, leadType: e.lead_type || 'unknown' });
  }
  for (const c of newContacts) {
    allItems.push({ type: 'new', contact: c, leadType: c.contact_type || 'unknown' });
  }

  // Shuffle
  for (let i = allItems.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allItems[i], allItems[j]] = [allItems[j], allItems[i]];
  }

  const sendTimes = generateSendTimes(allItems.length);

  // Preview schedule
  const byDay: Record<string, { total: number; byType: Record<string, number> }> = {};
  for (let i = 0; i < allItems.length; i++) {
    const dayKey = sendTimes[i].toISOString().split('T')[0];
    if (!byDay[dayKey]) byDay[dayKey] = { total: 0, byType: {} };
    byDay[dayKey].total++;
    byDay[dayKey].byType[allItems[i].leadType] = (byDay[dayKey].byType[allItems[i].leadType] || 0) + 1;
  }

  console.log('Staggered schedule:');
  for (const [day, info] of Object.entries(byDay).sort()) {
    const dow = new Date(day).toLocaleDateString('en-US', { weekday: 'short' });
    const breakdown = Object.entries(info.byType).map(([t, c]) => `${t}:${c}`).join(', ');
    console.log(`  ${day} (${dow}): ${info.total} emails  [${breakdown}]`);
  }
  console.log(`\nTotal: ${totalItems} emails over ${Object.keys(byDay).length} business days\n`);

  if (dryRun) {
    console.log('Preview (first 15):');
    for (let i = 0; i < Math.min(15, allItems.length); i++) {
      const item = allItems[i];
      const time = sendTimes[i].toISOString().replace('T', ' ').slice(0, 19);
      if (item.type === 'parked') {
        console.log(`  ${time} → [reschedule] parked email #${item.parkedId} [${item.leadType}]`);
      } else {
        console.log(`  ${time} → [new] ${item.contact!.name} <${item.contact!.email}> [${item.leadType}]`);
      }
    }
    console.log('\nRe-run without --dry-run to execute.');
    process.exit(0);
  }

  // ── Execute ─────────────────────────────────────────────────────────────
  let rescheduled = 0;
  let created = 0;
  let errors = 0;

  for (let i = 0; i < allItems.length; i++) {
    const item = allItems[i];
    const sendTime = sendTimes[i].toISOString();

    try {
      if (item.type === 'parked') {
        // Reschedule existing parked email
        await pool.query(
          `UPDATE scheduled_emails SET scheduled_for = $1 WHERE id = $2`,
          [sendTime, item.parkedId]
        );
        rescheduled++;
      } else {
        // Create new scheduled email
        const c = item.contact!;
        const email = getEmail1(c);
        const htmlBody = buildHtml(email.body);

        await pool.query(
          `INSERT INTO scheduled_emails (contact_id, to_email, subject, body, html_body, lead_type, scheduled_for)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [c.id, c.email, email.subject, email.body, htmlBody, c.contact_type, sendTime]
        );

        await pool.query(
          `UPDATE contacts SET status = 'contacted', updated_at = NOW() WHERE id = $1`,
          [c.id]
        );
        created++;
      }

      const total = rescheduled + created;
      if (total % 50 === 0) {
        console.log(`  Progress: ${total}/${allItems.length} (${rescheduled} rescheduled, ${created} new)...`);
      }
    } catch (err: any) {
      console.error(`  Error processing item ${i}:`, err.message);
      errors++;
    }
  }

  console.log(`\nDone.`);
  console.log(`  Rescheduled: ${rescheduled} parked emails`);
  console.log(`  Created:     ${created} new emails`);
  console.log(`  Errors:      ${errors}`);
  console.log('\nThe send-emails cron will pick these up automatically at their scheduled times.');

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
