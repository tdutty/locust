/**
 * Disqualify contact rows for internal/founder addresses so the
 * process-inbox cron stops treating their inbound mail as a landlord
 * reply. Pairs with a code-level guard in process-inbox/route.ts.
 */
import { Client } from 'pg'

const INTERNAL_PATTERNS = [
  'terrellgilb%@gmail.com',
  '%@sweetlease.io',
  'rgilbert@%',
  'robert@%',
]

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set')
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
  await client.connect()

  const where = INTERNAL_PATTERNS.map(() => `email ILIKE $${INTERNAL_PATTERNS.indexOf(arguments[0]) + 1}`)
  // simpler: build OR list inline
  const conditions = INTERNAL_PATTERNS.map((_, i) => `email ILIKE $${i + 1}`).join(' OR ')

  const before = await client.query(`
    SELECT id, email, contact_type, status FROM contacts WHERE ${conditions}
  `, INTERNAL_PATTERNS)
  console.log(`Affected contacts (${before.rowCount}):`)
  for (const r of before.rows) console.log(`  id=${r.id} ${r.email} type=${r.contact_type} status=${r.status}`)

  // Mark as disqualified + tag in notes so the process-inbox path's
  // unsubscribe / disqualified handling kicks in
  const upd = await client.query(`
    UPDATE contacts
    SET status = 'disqualified',
        notes = COALESCE(notes, '') || ' [Internal: founder/team address - excluded from outreach]',
        updated_at = NOW()
    WHERE ${conditions}
    RETURNING id, email
  `, INTERNAL_PATTERNS)
  console.log(`\nDisqualified ${upd.rowCount} internal contact rows.`)

  // Stop active sequences targeting these contacts
  const stoppedSeq = await client.query(`
    UPDATE contact_sequences SET status = 'stopped', updated_at = NOW()
    WHERE contact_id IN (${upd.rows.map((_, i) => `$${i + 1}`).join(',') || 'NULL'})
      AND status = 'active'
    RETURNING id
  `, upd.rows.map(r => r.id))
  console.log(`Stopped ${stoppedSeq.rowCount} active sequences pointing at internal addresses.`)

  // Cancel any pending scheduled_emails to internal addresses
  const cancelled = await client.query(`
    UPDATE scheduled_emails SET status = 'cancelled'
    WHERE status IN ('pending', 'paused') AND (${conditions.replace(/email/g, 'to_email')})
    RETURNING id
  `, INTERNAL_PATTERNS)
  console.log(`Cancelled ${cancelled.rowCount} pending scheduled_emails to internal addresses.`)

  await client.end()
}

main().catch(err => { console.error(err); process.exit(1) })
