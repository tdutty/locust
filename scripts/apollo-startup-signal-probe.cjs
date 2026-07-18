/* VALIDATION PROBE (search-only, no email reveals = no reveal credits).
 * Confirms Apollo honors the Series A-C + metro + size filters before we
 * spend credits revealing 100-200 contacts. Prints funding-stage + metro
 * distribution and sample companies so we can eyeball the signal quality.
 *
 * Run: node scripts/apollo-startup-signal-probe.cjs
 */
require('dotenv').config({ path: '.env' })
require('dotenv').config({ path: '.env.local' })

const KEY = process.env.APOLLO_API_KEY
const SEARCH = 'https://api.apollo.io/api/v1/mixed_people/api_search'

// People/Talent leaders who own relocation/benefits at a funded startup.
const TITLES = [
  'Chief People Officer', 'VP People', 'Head of People', 'Head of Talent',
  'Director of People', 'People Operations', 'Head of Total Rewards',
  'Head of Talent Acquisition', 'Chief of Staff',
]

// Startup hubs drawn from our target-city + university-feeder metros.
const METROS = [
  'San Francisco, California', 'New York, New York', 'Boston, Massachusetts',
  'Austin, Texas', 'Seattle, Washington', 'Los Angeles, California',
  'Denver, Colorado', 'Chicago, Illinois',
]

// Apollo latest-funding-stage labels for Series A-C. We send these and
// also inspect what the API returns, in case it expects numeric codes.
const FUNDING_STAGES = ['Series A', 'Series B', 'Series C']

async function search(page) {
  const body = {
    person_titles: TITLES,
    person_locations: METROS,
    organization_num_employees_ranges: ['21,200', '201,1000'],
    organization_latest_funding_stage_cd: FUNDING_STAGES,
    page,
    per_page: 25,
  }
  const r = await fetch(SEARCH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'X-Api-Key': KEY },
    body: JSON.stringify(body),
  })
  const text = await r.text()
  if (!r.ok) return { status: r.status, error: text.slice(0, 300) }
  return { status: 200, data: JSON.parse(text) }
}

;(async () => {
  if (!KEY) { console.log('NO APOLLO KEY'); process.exit(1) }
  const res = await search(1)
  if (res.error) { console.log('SEARCH ERROR', res.status, res.error); process.exit(1) }
  const d = res.data
  const people = d.people || []
  const pag = d.pagination || {}
  console.log(`total_entries: ${pag.total_entries} | total_pages: ${pag.total_pages} | page1 people: ${people.length}`)

  // What org fields does Apollo actually return? Inspect the first org.
  const o0 = people[0]?.organization || {}
  console.log('\norg fields available:', Object.keys(o0).filter(k => /fund|employ|found|stage|name/i.test(k)).join(', '))

  const stageDist = {}, metroDist = {}
  const samples = []
  for (const p of people) {
    const o = p.organization || {}
    const stage = o.latest_funding_stage || o.funding_stage || '(none)'
    stageDist[stage] = (stageDist[stage] || 0) + 1
    const loc = p.city ? `${p.city}, ${p.state || ''}` : '(no city)'
    metroDist[loc] = (metroDist[loc] || 0) + 1
    if (samples.length < 12) samples.push(`${(o.name || '?').slice(0, 26).padEnd(26)} ${String(o.estimated_num_employees || '?').padStart(5)} emp | ${stage.padEnd(10)} | ${p.title?.slice(0, 26) || '?'} | ${loc}`)
  }
  console.log('\nfunding-stage distribution (page 1):', JSON.stringify(stageDist))
  console.log('metro distribution:', JSON.stringify(metroDist))
  console.log('\nsample companies + contacts (no emails revealed):')
  for (const s of samples) console.log('  ', s)
})().catch(e => { console.error('FATAL', e.message); process.exit(1) })
