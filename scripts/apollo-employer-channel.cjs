/* Find employer-channel outreach contacts via Apollo.
 * Searches each target company for channel-appropriate titles, ranks by
 * seniority, reveals the top pick's email. Read-only besides Apollo reveals. */
require('dotenv').config({ path: '.env' })
require('dotenv').config({ path: '.env.local' })

const KEY = process.env.APOLLO_API_KEY
const SEARCH = 'https://api.apollo.io/api/v1/mixed_people/api_search'
const MATCH = 'https://api.apollo.io/api/v1/people/match'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Title priority sets per channel (higher index in array = lower priority).
const TITLES = {
  startup: [
    'Chief People Officer', 'VP People', 'Head of People', 'Head of Talent',
    'Director of People', 'Head of Talent Acquisition', 'People Operations',
    'Director of Recruiting', 'Chief of Staff', 'Recruiting Lead',
  ],
  hr_platform: [
    'Head of Partnerships', 'VP Partnerships', 'VP Business Development',
    'Head of Channel Partnerships', 'Director of Partnerships',
    'Head of Marketplace', 'Partnerships', 'Business Development',
    'Partner Manager',
  ],
  vc: [
    'Head of Platform', 'VP Platform', 'Head of Talent', 'Talent Partner',
    'Director of Platform', 'Head of Portfolio', 'Portfolio Services',
    'Operating Partner', 'Platform', 'Head of Community',
  ],
  rmc: [
    'Head of Partnerships', 'VP Business Development', 'Director of Partnerships',
    'Head of Supplier Relations', 'Strategic Partnerships', 'Vendor Management',
    'Partnerships', 'Business Development',
  ],
}

const COMPANIES = [
  // Startups -> Head of People / Talent
  ['Decagon', 'decagon.ai', 'startup'],
  ['Read AI', 'read.ai', 'startup'],
  ['Nominal', 'nominal.io', 'startup'],
  ['Rain', 'rain.us', 'startup'],
  ['Aeropay', 'aeropay.com', 'startup'],
  ['Alloy', 'alloy.com', 'startup'],
  ['Pickle Robot', 'picklerobot.com', 'startup'],
  ['Cursor', 'cursor.com', 'startup'],
  ['Sierra', 'sierra.ai', 'startup'],
  // HR platforms / PEO -> Partnerships
  ['BambooHR', 'bamboohr.com', 'hr_platform'],
  ['ADP', 'adp.com', 'hr_platform'],
  ['Deel', 'deel.com', 'hr_platform'],
  ['Rippling', 'rippling.com', 'hr_platform'],
  ['Paychex', 'paychex.com', 'hr_platform'],
  ['Gusto', 'gusto.com', 'hr_platform'],
  ['TriNet', 'trinet.com', 'hr_platform'],
  ['Justworks', 'justworks.com', 'hr_platform'],
  ['Forma', 'joinforma.com', 'hr_platform'],
  // VC -> Platform / Talent / Perks
  ['Y Combinator', 'ycombinator.com', 'vc'],
  ['Insight Partners', 'insightpartners.com', 'vc'],
  ['Techstars', 'techstars.com', 'vc'],
  ['Bessemer', 'bvp.com', 'vc'],
  ['500 Global', '500.co', 'vc'],
  ['a16z', 'a16z.com', 'vc'],
  ['First Round', 'firstround.com', 'vc'],
  ['Greylock', 'greylock.com', 'vc'],
  // RMC / mobility -> BD / Partnerships
  ['UrbanBound', 'urbanbound.com', 'rmc'],
  ['Graebel', 'graebel.com', 'rmc'],
  ['Benivo', 'benivo.com', 'rmc'],
  ['Topia', 'topia.com', 'rmc'],
  ['ReloQuest', 'reloquest.com', 'rmc'],
  ['Relocity', 'relocity.com', 'rmc'],
]

function scoreTitle(title, channel) {
  if (!title) return -1
  const t = title.toLowerCase()
  const set = TITLES[channel]
  let best = -1
  set.forEach((kw, i) => {
    if (t.includes(kw.toLowerCase())) {
      const s = set.length - i // earlier = higher
      if (s > best) best = s
    }
  })
  // Seniority bumps
  if (/\b(chief|vp|vice president|head)\b/.test(t)) best += 0.5
  if (/\b(director)\b/.test(t)) best += 0.25
  return best
}

async function search(domain, channel) {
  const body = {
    q_organization_domains_list: [domain],
    person_titles: TITLES[channel],
    page: 1,
    per_page: 10,
  }
  const r = await fetch(SEARCH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'X-Api-Key': KEY },
    body: JSON.stringify(body),
  })
  if (!r.ok) return { error: `search ${r.status}` }
  const d = await r.json()
  return { people: d.people || [] }
}

async function reveal(id) {
  const r = await fetch(MATCH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'X-Api-Key': KEY },
    body: JSON.stringify({ id, reveal_personal_emails: true }),
  })
  if (!r.ok) return { error: `match ${r.status}` }
  const d = await r.json()
  return { person: d.person }
}

;(async () => {
  if (!KEY) { console.log('NO APOLLO KEY'); process.exit(1) }
  const results = []
  for (const [name, domain, channel] of COMPANIES) {
    try {
      const { people, error } = await search(domain, channel)
      if (error) { results.push({ name, domain, channel, error }); console.log(`✗ ${name}: ${error}`); continue }
      if (!people.length) { results.push({ name, domain, channel, note: 'no candidates' }); console.log(`- ${name}: no candidates (domain ${domain}?)`); continue }
      const ranked = people
        .map((p) => ({ p, score: scoreTitle(p.title, channel) }))
        .sort((a, b) => b.score - a.score)
      const top = ranked[0].p
      const backups = ranked.slice(1, 3).map((x) => `${x.p.first_name} (${x.p.title})`)
      const rev = await reveal(top.id)
      const person = rev.person || {}
      const email = person.email || (person.personal_emails && person.personal_emails[0]) || top.email || '(no email)'
      const full = [person.first_name || top.first_name, person.last_name].filter(Boolean).join(' ')
      const entry = {
        name, domain, channel,
        contact: full || top.first_name,
        title: top.title,
        email,
        linkedin: person.linkedin_url || top.linkedin_url || '',
        backups,
      }
      results.push(entry)
      console.log(`✓ ${name} [${channel}] -> ${entry.contact} | ${entry.title} | ${email}`)
      await sleep(400)
    } catch (e) {
      results.push({ name, domain, channel, error: e.message })
      console.log(`✗ ${name}: ${e.message}`)
    }
  }
  const fs = require('fs')
  const out = '/Users/terrellgilbert/sweetlease/marketing/employer_channel_contacts.json'
  fs.writeFileSync(out, JSON.stringify(results, null, 2))
  console.log(`\nSaved ${results.length} rows -> ${out}`)
})()
