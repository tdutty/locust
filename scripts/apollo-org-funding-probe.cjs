/* Probe Apollo ORGANIZATION search for the Series A-C signal. Org search
 * (unlike people api_search) returns funding data, so this is where the
 * stage/size/metro filter has to live. Search-only, no reveals.
 *
 * Run: node scripts/apollo-org-funding-probe.cjs
 */
require('dotenv').config({ path: '.env' })
require('dotenv').config({ path: '.env.local' })

const KEY = process.env.APOLLO_API_KEY
const ORG_SEARCH = 'https://api.apollo.io/api/v1/mixed_companies/search'

async function run() {
  const body = {
    organization_num_employees_ranges: ['21,200', '201,1000'],
    organization_locations: ['San Francisco, California', 'New York, New York', 'Austin, Texas'],
    // Try the documented funding-stage filter. If ignored, we post-filter.
    latest_funding_stage_cd: ['series_a', 'series_b', 'series_c'],
    page: 1,
    per_page: 25,
  }
  const r = await fetch(ORG_SEARCH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'X-Api-Key': KEY },
    body: JSON.stringify(body),
  })
  const text = await r.text()
  if (!r.ok) { console.log('ORG SEARCH ERROR', r.status, text.slice(0, 400)); return }
  const d = JSON.parse(text)
  const orgs = d.organizations || d.accounts || []
  const pag = d.pagination || {}
  console.log(`total_entries: ${pag.total_entries} | page1 orgs: ${orgs.length}`)
  if (orgs[0]) console.log('\norg funding fields:', Object.keys(orgs[0]).filter(k => /fund|stage|round|employ|found/i.test(k)).join(', '))

  const stageDist = {}
  const rows = []
  for (const o of orgs) {
    const stage = o.latest_funding_stage || '(none)'
    stageDist[stage] = (stageDist[stage] || 0) + 1
    rows.push(`${(o.name || '?').slice(0, 24).padEnd(24)} ${String(o.estimated_num_employees || '?').padStart(5)} emp | ${String(stage).padEnd(12)} | raised: ${o.latest_funding_round_date || '?'} | ${o.primary_domain || o.website_url || '?'}`)
  }
  console.log('\nfunding-stage distribution:', JSON.stringify(stageDist))
  console.log('\nsample orgs:')
  for (const s of rows.slice(0, 15)) console.log('  ', s)
}

;(async () => { if (!KEY) { console.log('NO KEY'); process.exit(1) } await run() })()
  .catch(e => { console.error('FATAL', e.message); process.exit(1) })
