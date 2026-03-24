import { config } from 'dotenv';
config({ path: '.env.local', override: true });
import { Pool } from 'pg';

const cs = (process.env.DATABASE_URL || '').replace(/[?&]sslmode=[^&]*/g, '');
const pool = new Pool({ connectionString: cs, ssl: cs.includes('ondigitalocean.com') ? { rejectUnauthorized: false } : undefined, max: 1, idleTimeoutMillis: 3000 });

async function main() {
  const r = await pool.query(`
    SELECT city, state, contact_type, COUNT(*) as cnt,
           COUNT(CASE WHEN email IS NOT NULL THEN 1 END) as with_email
    FROM contacts
    WHERE city IS NOT NULL
    GROUP BY city, state, contact_type
    ORDER BY city, state, contact_type
  `);

  const cities: Record<string, { residency: number; university: number; employer: number; total: number; emails: number }> = {};
  for (const row of r.rows) {
    const key = row.city + ', ' + (row.state || '??');
    if (!(key in cities)) {
      cities[key] = { residency: 0, university: 0, employer: 0, total: 0, emails: 0 };
    }
    const ct = row.contact_type || 'other';
    if (ct === 'residency') cities[key].residency += parseInt(row.cnt);
    else if (ct === 'university') cities[key].university += parseInt(row.cnt);
    else if (ct === 'employer') cities[key].employer += parseInt(row.cnt);
    cities[key].total += parseInt(row.cnt);
    cities[key].emails += parseInt(row.with_email);
  }

  const sorted = Object.entries(cities).sort((a, b) => b[1].total - a[1].total);

  console.log('City                          | Residency | University | Employer | Total | w/Email');
  console.log('-'.repeat(90));
  let grandTotal = 0;
  let grandEmails = 0;
  for (const [city, d] of sorted) {
    const line = city.padEnd(30)
      + '| ' + String(d.residency).padStart(9)
      + ' | ' + String(d.university).padStart(10)
      + ' | ' + String(d.employer).padStart(8)
      + ' | ' + String(d.total).padStart(5)
      + ' | ' + String(d.emails).padStart(7);
    console.log(line);
    grandTotal += d.total;
    grandEmails += d.emails;
  }
  console.log('-'.repeat(90));
  console.log('TOTAL'.padEnd(30) + '|           |            |          | ' + String(grandTotal).padStart(5) + ' | ' + String(grandEmails).padStart(7));

  await pool.end();
}

main();
