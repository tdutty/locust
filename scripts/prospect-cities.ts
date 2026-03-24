/**
 * Prospect major US cities for:
 *   1. Medical residency housing coordinators (GME)
 *   2. University graduate housing personnel
 *   3. Employer relocation/benefits people
 *
 * Uses Apollo API to search → enrich → import into contacts table.
 *
 * Run:  npx tsx scripts/prospect-cities.ts [--dry-run] [--limit=N]
 */

import { config } from 'dotenv';
config({ path: '.env.local', override: true });

import { Pool } from 'pg';

const APOLLO_API_KEY = process.env.APOLLO_API_KEY;
if (!APOLLO_API_KEY) {
  console.error('APOLLO_API_KEY required in .env.local');
  process.exit(1);
}

const connectionString = (process.env.DATABASE_URL || '').replace(/[?&]sslmode=[^&]*/g, '');
const isRemote = connectionString.includes('ondigitalocean.com') || process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString,
  ssl: isRemote ? { rejectUnauthorized: false } : undefined,
  max: 1,
  idleTimeoutMillis: 5000,
});

const APOLLO_BASE = 'https://api.apollo.io/api/v1';

// ─── Major US cities & hubs ──────────────────────────────────────────────────

const CITIES = [
  // Tier 1 — largest metros
  'New York, New York',
  'Los Angeles, California',
  'Chicago, Illinois',
  'Houston, Texas',
  'Dallas, Texas',
  'San Francisco, California',
  'Washington, District of Columbia',
  'Miami, Florida',
  'Atlanta, Georgia',
  'Boston, Massachusetts',
  'Philadelphia, Pennsylvania',
  'Phoenix, Arizona',
  'Seattle, Washington',
  'Denver, Colorado',
  'San Diego, California',
  'Minneapolis, Minnesota',

  // Tier 2 — strong medical / university / corporate hubs
  'Austin, Texas',
  'Nashville, Tennessee',
  'Charlotte, North Carolina',
  'Raleigh, North Carolina',
  'Pittsburgh, Pennsylvania',
  'Baltimore, Maryland',
  'Salt Lake City, Utah',
  'Portland, Oregon',
  'San Antonio, Texas',
  'Columbus, Ohio',
  'Indianapolis, Indiana',
  'Cleveland, Ohio',
  'St. Louis, Missouri',
  'Tampa, Florida',
  'Orlando, Florida',
  'Detroit, Michigan',
  'Milwaukee, Wisconsin',
  'Kansas City, Missouri',
  'Cincinnati, Ohio',
  'Richmond, Virginia',
  'New Orleans, Louisiana',
  'Jacksonville, Florida',
  'Louisville, Kentucky',
  'Oklahoma City, Oklahoma',
  'Memphis, Tennessee',
  'Birmingham, Alabama',
  'Buffalo, New York',
  'Rochester, New York',
  'Hartford, Connecticut',
  'Providence, Rhode Island',
  'Albuquerque, New Mexico',
  'Tucson, Arizona',
  'Omaha, Nebraska',
  'Madison, Wisconsin',
  'Ann Arbor, Michigan',
];

// ─── Search templates ────────────────────────────────────────────────────────

interface SearchTemplate {
  id: string;
  contactType: string;
  titles: string[];
  orgKeywords: string[];
  employeeRanges?: string[];
}

const TEMPLATES: SearchTemplate[] = [
  {
    id: 'residency-coordinators',
    contactType: 'residency',
    titles: [
      'Residency Program Coordinator',
      'GME Coordinator',
      'Residency Program Director',
      'Residency Program Administrator',
      'GME Program Manager',
      'Medical Education Coordinator',
      'Residency Program Manager',
      'Associate Program Director',
      'GME Administrator',
      'Graduate Medical Education Director',
    ],
    orgKeywords: ['hospital', 'medical center', 'health system', 'teaching hospital', 'academic medical center'],
  },
  {
    id: 'graduate-housing',
    contactType: 'university',
    titles: [
      'Director of Housing',
      'Housing Director',
      'Director of Residential Life',
      'Off-Campus Housing Coordinator',
      'Student Housing Director',
      'Associate Director of Housing',
      'Housing Operations Director',
      'Director of Auxiliary Services',
      'Graduate Housing Coordinator',
      'Assistant Director of Housing',
    ],
    orgKeywords: ['university', 'college', 'school'],
  },
  {
    id: 'employer-relocation',
    contactType: 'employer',
    titles: [
      'Relocation Manager',
      'Global Mobility Manager',
      'HR Director',
      'VP of People',
      'Head of People Operations',
      'Director of Employee Experience',
      'Talent Acquisition Director',
      'Director of Total Rewards',
      'VP Human Resources',
      'Head of Total Rewards',
    ],
    orgKeywords: [],
    employeeRanges: ['51,200', '201,500', '501,1000', '1001,5000', '5001,10000'],
  },
];

// ─── Apollo API helpers ──────────────────────────────────────────────────────

async function apolloSearch(
  template: SearchTemplate,
  location: string,
  page: number = 1,
  perPage: number = 25,
): Promise<{ people: any[]; totalEntries: number }> {
  const payload: any = {
    page,
    per_page: perPage,
    person_titles: template.titles,
    person_locations: [location],
  };

  if (template.orgKeywords.length > 0) {
    payload.q_organization_keyword_tags = template.orgKeywords;
  }
  if (template.employeeRanges) {
    payload.organization_num_employees_ranges = template.employeeRanges;
  }

  const res = await fetch(`${APOLLO_BASE}/mixed_people/api_search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': APOLLO_API_KEY!,
      'Cache-Control': 'no-cache',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apollo search failed (${res.status}): ${text.substring(0, 200)}`);
  }

  const data = await res.json();
  return {
    people: data.people || [],
    totalEntries: data.pagination?.total_entries || 0,
  };
}

async function apolloEnrich(ids: string[]): Promise<any[]> {
  const res = await fetch(`${APOLLO_BASE}/people/bulk_match`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': APOLLO_API_KEY!,
    },
    body: JSON.stringify({ details: ids.map(id => ({ id })) }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apollo enrich failed (${res.status}): ${text.substring(0, 200)}`);
  }

  const data = await res.json();
  return data.matches || [];
}

// ─── DB insert ───────────────────────────────────────────────────────────────

async function insertContact(contact: any, template: SearchTemplate, requireEmail: boolean = true): Promise<'inserted' | 'duplicate' | 'no_email'> {
  if (!contact.id) return 'no_email';
  if (!contact.email && requireEmail) return 'no_email';

  try {
    await pool.query(
      `INSERT INTO contacts (
        apollo_id, first_name, last_name, name, title, email, email_status,
        phone, linkedin_url, city, state, country,
        org_name, org_website, org_industry, org_employee_count, org_city, org_state,
        source_template, contact_type, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,'new')
      ON CONFLICT (apollo_id) DO NOTHING`,
      [
        contact.id,
        contact.first_name,
        contact.last_name,
        contact.name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unknown',
        contact.title,
        contact.email,
        contact.email_status,
        contact.phone_numbers?.[0]?.raw_number || contact.sanitized_phone || null,
        contact.linkedin_url,
        contact.city,
        contact.state,
        contact.country,
        contact.organization?.name || contact.employment_history?.[0]?.organization_name || null,
        contact.organization?.website_url || null,
        contact.organization?.industry || null,
        contact.organization?.estimated_num_employees || null,
        contact.organization?.city || null,
        contact.organization?.state || null,
        template.id,
        template.contactType,
      ]
    );
    return 'inserted';
  } catch (err: any) {
    if (err.code === '23505') return 'duplicate'; // unique violation
    throw err;
  }
}

// ─── Rate limiter ────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const noEnrich = process.argv.includes('--no-enrich');
  const limitArg = process.argv.find(a => a.startsWith('--limit='));
  const pageLimit = limitArg ? parseInt(limitArg.split('=')[1]) : 3; // pages per city/template combo

  console.log(dryRun ? '\n=== DRY RUN ===' : noEnrich ? '\n=== LIVE RUN (no enrich) ===' : '\n=== LIVE RUN ===');
  console.log(`Cities: ${CITIES.length}`);
  console.log(`Templates: ${TEMPLATES.map(t => t.id).join(', ')}`);
  console.log(`Pages per search: ${pageLimit} (${pageLimit * 100} contacts max per city/template)`);
  console.log(`Total searches: ${CITIES.length * TEMPLATES.length}\n`);

  const stats = {
    searches: 0,
    peopleFound: 0,
    enriched: 0,
    inserted: 0,
    duplicates: 0,
    noEmail: 0,
    errors: 0,
    byType: {} as Record<string, { found: number; inserted: number }>,
  };

  for (const template of TEMPLATES) {
    stats.byType[template.contactType] = { found: 0, inserted: 0 };

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Template: ${template.id} (${template.contactType})`);
    console.log('='.repeat(60));

    for (const city of CITIES) {
      try {
        // Search page 1 (100 per page — new API max)
        const { people } = await apolloSearch(template, city, 1, 100);
        stats.searches++;

        if (people.length === 0) {
          continue; // skip cities with no results
        }

        let allPeople = [...people];

        // Fetch additional pages if page 1 was full
        for (let page = 2; page <= pageLimit && allPeople.length === (page - 1) * 100; page++) {
          await sleep(500); // rate limit
          const nextPage = await apolloSearch(template, city, page, 100);
          stats.searches++;
          allPeople.push(...nextPage.people);
        }

        const cityName = city.split(',')[0];
        stats.peopleFound += allPeople.length;
        stats.byType[template.contactType].found += allPeople.length;

        console.log(`  ${cityName}: ${allPeople.length} found`);

        if (dryRun) continue;

        if (noEnrich) {
          // Insert directly from search results (no enrichment credits used)
          // Save even without email — can enrich later
          for (const person of allPeople) {
            const result = await insertContact(person, template, false);
            if (result === 'inserted') {
              stats.inserted++;
              stats.byType[template.contactType].inserted++;
            } else if (result === 'duplicate') {
              stats.duplicates++;
            } else {
              stats.noEmail++;
            }
          }
        } else {
          // Enrich in batches of 10 (uses credits)
          const BATCH_SIZE = 10;
          for (let i = 0; i < allPeople.length; i += BATCH_SIZE) {
            const batch = allPeople.slice(i, i + BATCH_SIZE);
            const ids = batch.map((p: any) => p.id).filter(Boolean);

            if (ids.length === 0) continue;

            try {
              await sleep(300); // rate limit
              const enriched = await apolloEnrich(ids);
              stats.enriched += enriched.length;

              for (const contact of enriched) {
                const result = await insertContact(contact, template);
                if (result === 'inserted') {
                  stats.inserted++;
                  stats.byType[template.contactType].inserted++;
                } else if (result === 'duplicate') {
                  stats.duplicates++;
                } else {
                  stats.noEmail++;
                }
              }
            } catch (enrichErr: any) {
              console.error(`    Enrich batch error: ${enrichErr.message}`);
              stats.errors++;
            }
          }
        }
      } catch (searchErr: any) {
        console.error(`  ${city}: search error — ${searchErr.message}`);
        stats.errors++;
        if (searchErr.message.includes('429') || searchErr.message.includes('rate')) {
          console.log('  Rate limited — pausing 60s...');
          await sleep(60000);
        }
      }

      await sleep(400); // breathing room between cities
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log(`\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`  API searches:    ${stats.searches}`);
  console.log(`  People found:    ${stats.peopleFound}`);
  if (!dryRun) {
    console.log(`  Enriched:        ${stats.enriched}`);
    console.log(`  Inserted:        ${stats.inserted}`);
    console.log(`  Duplicates:      ${stats.duplicates}`);
    console.log(`  No email:        ${stats.noEmail}`);
    console.log(`  Errors:          ${stats.errors}`);
  }
  console.log('\n  By type:');
  for (const [type, data] of Object.entries(stats.byType)) {
    console.log(`    ${type}: ${data.found} found${dryRun ? '' : `, ${data.inserted} inserted`}`);
  }

  await pool.end();
  process.exit(0);
}

main().catch(async err => {
  console.error('Fatal error:', err);
  await pool.end().catch(() => {});
  process.exit(1);
});
