/**
 * Snapshot + pause Locust's pending scheduled_emails queue.
 *
 *   npx tsx scripts/pause-pending-emails.ts            # snapshot only
 *   npx tsx scripts/pause-pending-emails.ts --pause    # snapshot + pause
 *   npx tsx scripts/pause-pending-emails.ts --resume   # flip paused back to pending
 */
import { Client } from 'pg'

const args = process.argv.slice(2)
const doPause = args.includes('--pause')
const doResume = args.includes('--resume')

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set')

  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
  await client.connect()

  if (doResume) {
    const r = await client.query(
      `UPDATE scheduled_emails SET status = 'pending'
       WHERE status = 'paused' RETURNING id`
    )
    console.log(`Resumed ${r.rowCount} scheduled_emails -> pending`)
    await client.end()
    return
  }

  // Snapshot
  const total = await client.query(
    `SELECT COUNT(*)::int AS n FROM scheduled_emails WHERE status = 'pending'`
  )
  console.log(`\nTotal pending: ${total.rows[0].n}`)

  const due = await client.query(
    `SELECT COUNT(*)::int AS n FROM scheduled_emails
     WHERE status = 'pending' AND scheduled_for <= NOW()`
  )
  console.log(`Due now (about to send): ${due.rows[0].n}`)

  const byType = await client.query(
    `SELECT lead_type, COUNT(*)::int AS n
     FROM scheduled_emails WHERE status = 'pending'
     GROUP BY lead_type ORDER BY n DESC`
  )
  console.log(`\nBy lead_type:`)
  for (const r of byType.rows) console.log(`  ${r.lead_type || '(null)'}: ${r.n}`)

  const next20 = await client.query(
    `SELECT id, to_email, subject, lead_type, scheduled_for
     FROM scheduled_emails WHERE status = 'pending'
     ORDER BY scheduled_for ASC LIMIT 20`
  )
  console.log(`\nNext 20 due:`)
  for (const r of next20.rows) {
    const when = new Date(r.scheduled_for).toISOString().slice(0, 16).replace('T', ' ')
    console.log(`  ${when}  ${r.lead_type}  ${r.to_email}  | ${r.subject?.slice(0, 60) || ''}`)
  }

  // Show last 20 sent so we can see what just went out
  const recentSent = await client.query(
    `SELECT to_email, subject, lead_type, sent_at
     FROM scheduled_emails WHERE status = 'sent'
     ORDER BY sent_at DESC NULLS LAST LIMIT 20`
  )
  console.log(`\nLast 20 sent:`)
  for (const r of recentSent.rows) {
    const when = r.sent_at ? new Date(r.sent_at).toISOString().slice(0, 16).replace('T', ' ') : '(no sent_at)'
    console.log(`  ${when}  ${r.lead_type}  ${r.to_email}  | ${r.subject?.slice(0, 60) || ''}`)
  }

  // Check whether the founder's own address is in the queue
  const founderQ = await client.query(
    `SELECT id, to_email, subject, scheduled_for FROM scheduled_emails
     WHERE status = 'pending'
       AND (to_email ILIKE 'terrellgilb5%@gmail.com'
            OR to_email ILIKE '%@sweetlease.io'
            OR to_email ILIKE 'rgilbert@%'
            OR to_email ILIKE 'robert@%')`
  )
  if (founderQ.rowCount && founderQ.rowCount > 0) {
    console.log(`\nFOUNDER/INTERNAL ADDRESSES IN QUEUE (${founderQ.rowCount}):`)
    for (const r of founderQ.rows) console.log(`  ${r.to_email}: ${r.subject}`)
  }

  if (doPause) {
    const upd = await client.query(
      `UPDATE scheduled_emails SET status = 'paused'
       WHERE status = 'pending' RETURNING id`
    )
    console.log(`\nPaused ${upd.rowCount} scheduled_emails (status: pending -> paused)`)
    console.log(`To resume:  npx tsx scripts/pause-pending-emails.ts --resume`)
  } else {
    console.log(`\n(snapshot only - pass --pause to halt the queue)`)
  }

  await client.end()
}

main().catch(err => { console.error(err); process.exit(1) })
