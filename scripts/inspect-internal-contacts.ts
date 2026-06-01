/**
 * Find rows in contacts that point at internal addresses (founder /
 * sweetlease.io / outreach domain). Those rows make process-inbox treat
 * forwarded internal mail as a landlord lead and auto-reply to it.
 */
import { Client } from 'pg'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set')
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
  await client.connect()

  const r = await client.query(`
    SELECT id, name, email, contact_type, status, created_at, notes
    FROM contacts
    WHERE email ILIKE 'terrellgilb%@gmail.com'
       OR email ILIKE '%@sweetlease.io'
       OR email ILIKE 'rgilbert@%'
       OR email ILIKE 'robert@%'
    ORDER BY created_at DESC
  `)
  console.log(`Internal-address contacts (${r.rowCount}):`)
  for (const row of r.rows) {
    console.log(`  id=${row.id}  ${row.email}  type=${row.contact_type}  status=${row.status}  source=${row.source}  created=${row.created_at}`)
    if (row.notes) console.log(`    notes: ${String(row.notes).slice(0, 120)}`)
  }

  // Pending or any future-scheduled emails to these addresses
  const sched = await client.query(`
    SELECT id, to_email, lead_type, scheduled_for, status
    FROM scheduled_emails
    WHERE (to_email ILIKE 'terrellgilb%@gmail.com'
        OR to_email ILIKE '%@sweetlease.io'
        OR to_email ILIKE 'rgilbert@%'
        OR to_email ILIKE 'robert@%')
      AND status IN ('pending', 'paused')
    ORDER BY scheduled_for ASC
  `)
  console.log(`\nPending/paused scheduled_emails to internal addresses (${sched.rowCount}):`)
  for (const row of sched.rows) {
    console.log(`  id=${row.id}  ${row.to_email}  ${row.lead_type}  ${row.scheduled_for}  status=${row.status}`)
  }

  await client.end()
}

main().catch(err => { console.error(err); process.exit(1) })
