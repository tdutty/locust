/**
 * Trace why landlord-typed scheduled emails route to terrellgilb5@gmail.com.
 */
import { Client } from 'pg'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set')
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
  await client.connect()

  // Sample a landlord row going to terrellgilb5 to see lead_id + body
  const row = await client.query(`
    SELECT id, lead_id, lead_type, to_email, subject, body, scheduled_for, sent_at, status, message_id
    FROM scheduled_emails
    WHERE lead_type = 'landlord' AND to_email = 'terrellgilb5@gmail.com'
    ORDER BY sent_at DESC NULLS LAST
    LIMIT 5
  `)
  console.log(`\nLast 5 landlord -> terrellgilb5 rows:`)
  for (const r of row.rows) {
    console.log(`\n  id: ${r.id}  lead_id: ${r.lead_id}  sent_at: ${r.sent_at}`)
    console.log(`  subject: ${r.subject}`)
    console.log(`  body excerpt: ${(r.body || '').slice(0, 240).replace(/\n/g, ' ')}`)
  }

  if (row.rows.length === 0) {
    console.log('No matching rows.')
    await client.end()
    return
  }

  // Inspect the related landlord lead
  const leadId = row.rows[0].lead_id
  if (leadId) {
    // Try common lead table names
    for (const tbl of ['landlords', 'landlord_leads', 'leads', 'contacts']) {
      try {
        const lead = await client.query(`SELECT * FROM ${tbl} WHERE id = $1 LIMIT 1`, [leadId])
        if (lead.rows.length > 0) {
          console.log(`\nLead row from ${tbl} (id=${leadId}):`)
          for (const [k, v] of Object.entries(lead.rows[0])) {
            const val = typeof v === 'string' ? v.slice(0, 120) : v
            console.log(`  ${k}: ${val}`)
          }
          break
        }
      } catch {
        // table doesn't exist - try next
      }
    }
  }

  // Count by lead_id - is it always the same lead?
  const byLead = await client.query(`
    SELECT lead_id, COUNT(*)::int AS n, MIN(sent_at) AS first, MAX(sent_at) AS last
    FROM scheduled_emails
    WHERE lead_type = 'landlord' AND to_email = 'terrellgilb5@gmail.com'
    GROUP BY lead_id ORDER BY n DESC LIMIT 10
  `)
  console.log(`\nGrouped by lead_id:`)
  for (const r of byLead.rows) {
    console.log(`  lead_id=${r.lead_id}  count=${r.n}  first=${r.first}  last=${r.last}`)
  }

  await client.end()
}

main().catch(err => { console.error(err); process.exit(1) })
