import { config } from 'dotenv';
config({ path: '.env.local' });

import { Pool } from 'pg';

const connectionString = (process.env.DATABASE_URL || '').replace(/[?&]sslmode=[^&]*/g, '');
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

// ── CONFIGURATION ──
// Batch size: how many emails to release this run
const BATCH_SIZE = parseInt(process.argv[2] || '15', 10);
// Date to schedule for (default: today). Format: YYYY-MM-DD
const SEND_DATE = process.argv[3] || new Date().toISOString().split('T')[0];

async function main() {
  // 1. Hold ALL pending emails by pushing scheduled_for far into the future
  //    (only those not already held — i.e. those scheduled before 2099)
  const holdResult = await pool.query(`
    UPDATE scheduled_emails
    SET scheduled_for = '2099-01-01T00:00:00Z'
    WHERE status = 'pending' AND scheduled_for < '2099-01-01'
    RETURNING id
  `);
  console.log(`Held ${holdResult.rowCount} pending emails (scheduled_for → 2099)`);

  // 2. Count total held
  const totalResult = await pool.query(`
    SELECT COUNT(*) as total FROM scheduled_emails WHERE status = 'pending'
  `);
  const totalPending = parseInt(totalResult.rows[0].total, 10);

  // 3. Pick the next batch (oldest by id that are still pending at 2099)
  const batchResult = await pool.query(`
    SELECT id, to_email, lead_type FROM scheduled_emails
    WHERE status = 'pending' AND scheduled_for = '2099-01-01T00:00:00+00'
    ORDER BY id ASC
    LIMIT $1
  `, [BATCH_SIZE]);

  if (batchResult.rows.length === 0) {
    console.log('No pending emails to release.');
    await pool.end();
    process.exit(0);
  }

  // 4. Stagger across the day: 10-min spacing starting 9:00 AM CT (15:00 UTC)
  const startHour = 15;
  let released = 0;
  const byType: Record<string, number> = {};

  for (let i = 0; i < batchResult.rows.length; i++) {
    const email = batchResult.rows[i];
    const minuteOffset = i * 10;
    const hour = startHour + Math.floor(minuteOffset / 60);
    const minute = minuteOffset % 60;

    const scheduledFor = `${SEND_DATE}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`;

    await pool.query(
      `UPDATE scheduled_emails SET scheduled_for = $1 WHERE id = $2`,
      [scheduledFor, email.id]
    );

    released++;
    byType[email.lead_type || 'unknown'] = (byType[email.lead_type || 'unknown'] || 0) + 1;
  }

  const remaining = totalPending - released;
  const lastMinuteOffset = (released - 1) * 10;
  const endHour = 9 + Math.floor(lastMinuteOffset / 60);
  const endMin = lastMinuteOffset % 60;
  const endPeriod = endHour >= 12 ? 'PM' : 'AM';
  const endDisplay = endHour > 12 ? endHour - 12 : endHour;

  console.log(`\nReleased ${released} emails for ${SEND_DATE}:`);
  console.log(`  Window: 9:00 AM - ${endDisplay}:${String(endMin).padStart(2, '0')} ${endPeriod} CT (10-min spacing)`);
  console.log(`  By type:`, byType);
  console.log(`  Remaining held: ${remaining}`);
  console.log(`\nTo release the next batch, run:`);
  console.log(`  npx ts-node scripts/apply-warmup-schedule.ts <count> <YYYY-MM-DD>`);
  console.log(`  Example: npx ts-node scripts/apply-warmup-schedule.ts 25 2026-02-25`);
  console.log(`\nVerify with:`);
  console.log(`  SELECT DATE(scheduled_for AT TIME ZONE 'America/Chicago') as day, COUNT(*), MIN(scheduled_for), MAX(scheduled_for) FROM scheduled_emails WHERE status='pending' AND scheduled_for < '2099-01-01' GROUP BY day ORDER BY day;`);

  await pool.end();
  process.exit(0);
}

main();
