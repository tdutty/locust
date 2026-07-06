import { NextRequest, NextResponse } from 'next/server';
import { lookupProperty, searchGoogleMapsPMs } from '@/lib/hasdata';

export const maxDuration = 60;

/**
 * POST /api/pm-discovery
 *
 * Synchronous, webhook-secret-authed property-manager discovery for the
 * SweetLease crawler. Locust holds the APOLLO_API_KEY + HASDATA_API_KEY,
 * so the main app routes its crawler through here instead of calling
 * those providers directly.
 *
 * Auth: header `x-webhook-secret` must match SWEETLEASE_WEBHOOK_SECRET
 * (or LOCUST_WEBHOOK_SECRET as a fallback), same pattern as the other
 * tenant-match integration endpoints.
 *
 * Body:
 *   { action: 'apollo', city, state, perPage? }   -> { contacts: [...] }
 *   { action: 'hasdata', zillowUrl }              -> { agent: {...} | null }
 *   { action: 'maps', city, state, ll?, maxQueries? } -> { firms: [...], searchesRun }
 *   { action: 'enrich-domain', domain }          -> { contact: {...} | null }
 */

const APOLLO_API_URL = 'https://api.apollo.io/api/v1';
const APOLLO_API_KEY = process.env.APOLLO_API_KEY || '';
const WEBHOOK_SECRET = process.env.SWEETLEASE_WEBHOOK_SECRET || process.env.LOCUST_WEBHOOK_SECRET || '';

const PM_TITLES = [
  'Property Manager',
  'Leasing Director',
  'VP of Property Management',
  'Multifamily Asset Manager',
  'Director of Leasing',
  'Regional Property Manager',
  'Director of Property Management',
  'Leasing Manager',
  'Community Manager',
  'Director of Residential Operations',
];

const PM_ORG_KEYWORDS = ['property management', 'real estate', 'multifamily', 'apartment', 'residential'];

interface PmContact {
  id: string | null;
  name: string;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  email: string | null;
  emailStatus: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  company: string | null;
  website: string | null;
  city: string | null;
  state: string | null;
}

async function apolloDiscovery(city: string, state: string, perPage: number): Promise<PmContact[]> {
  if (!APOLLO_API_KEY) throw new Error('APOLLO_API_KEY not configured on Locust');

  // Step 1: search for people (IDs + preview)
  const searchResp = await fetch(`${APOLLO_API_URL}/mixed_people/api_search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'x-api-key': APOLLO_API_KEY },
    body: JSON.stringify({
      person_titles: PM_TITLES,
      person_locations: [`${city}, ${state}`],
      q_organization_keyword_tags: PM_ORG_KEYWORDS,
      page: 1,
      per_page: perPage,
    }),
  });
  if (!searchResp.ok) {
    throw new Error(`Apollo search ${searchResp.status}: ${(await searchResp.text()).slice(0, 200)}`);
  }
  const searchData = await searchResp.json();
  const people = searchData.people || [];
  if (people.length === 0) return [];

  // Step 2: bulk_match in batches of 10 to reveal emails
  const enrichMap = new Map<string, any>();
  for (let i = 0; i < people.length; i += 10) {
    const batch = people.slice(i, i + 10);
    try {
      const enrichResp = await fetch(`${APOLLO_API_URL}/people/bulk_match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': APOLLO_API_KEY },
        body: JSON.stringify({ details: batch.map((p: any) => ({ id: p.id })) }),
      });
      if (enrichResp.ok) {
        const enrichData = await enrichResp.json();
        for (const m of (enrichData.matches || []).filter(Boolean)) enrichMap.set(m.id, m);
      }
    } catch {
      // batch enrich failed; fall back to preview data for these
    }
  }

  return people.map((p: any): PmContact => {
    const e = enrichMap.get(p.id);
    if (e) {
      return {
        id: e.id,
        name: e.name || `${e.first_name || ''} ${e.last_name || ''}`.trim(),
        firstName: e.first_name || null,
        lastName: e.last_name || null,
        title: e.title || null,
        email: e.email || null,
        emailStatus: e.email_status || null,
        phone: e.phone_numbers?.[0]?.raw_number || e.sanitized_phone || null,
        linkedinUrl: e.linkedin_url || null,
        company: e.organization?.name || e.employment_history?.[0]?.organization_name || null,
        website: e.organization?.website_url || null,
        city: e.city || null,
        state: e.state || null,
      };
    }
    return {
      id: p.id || null,
      name: p.name || p.first_name || 'Unknown',
      firstName: p.first_name || null,
      lastName: p.last_name || null,
      title: p.title || null,
      email: null,
      emailStatus: null,
      phone: null,
      linkedinUrl: null,
      company: p.organization?.name || null,
      website: null,
      city: null,
      state: null,
    };
  });
}

// Titles that own leasing / represent the firm at a small PM company,
// ranked so we reveal the most decision-making contact first.
const PM_ENRICH_TITLES = [
  'Owner', 'Principal', 'President', 'Founder', 'Managing Broker', 'Broker',
  'Managing Partner', 'Director of Leasing', 'Property Manager', 'Leasing Manager',
  'Regional Manager', 'Community Manager', 'Operations Manager', 'Leasing Consultant',
];

function enrichTitleScore(title: string | null): number {
  if (!title) return -1;
  const t = title.toLowerCase();
  let best = -1;
  PM_ENRICH_TITLES.forEach((kw, i) => {
    if (t.includes(kw.toLowerCase())) { const s = PM_ENRICH_TITLES.length - i; if (s > best) best = s; }
  });
  if (/\b(owner|principal|president|founder|broker)\b/.test(t)) best += 0.5;
  if (/\b(director|manager)\b/.test(t)) best += 0.25;
  return best;
}

/**
 * Find a contact email at a PM firm by its domain. Apollo people search
 * (scoped to the domain) + a single reveal of the highest-ranked contact.
 * Returns the contact or null when the firm has no indexed people / email.
 */
async function apolloEnrichByDomain(domain: string): Promise<{
  name: string; email: string; title: string | null; phone: string | null; linkedinUrl: string | null;
} | null> {
  if (!APOLLO_API_KEY) throw new Error('APOLLO_API_KEY not configured on Locust');

  const searchResp = await fetch(`${APOLLO_API_URL}/mixed_people/api_search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'x-api-key': APOLLO_API_KEY },
    body: JSON.stringify({ q_organization_domains_list: [domain], person_titles: PM_ENRICH_TITLES, page: 1, per_page: 10 }),
  });
  if (!searchResp.ok) throw new Error(`Apollo search ${searchResp.status}: ${(await searchResp.text()).slice(0, 160)}`);
  const people = (await searchResp.json()).people || [];
  if (people.length === 0) return null;

  const ranked = people
    .map((p: any) => ({ p, score: enrichTitleScore(p.title) }))
    .sort((a: any, b: any) => b.score - a.score);
  const top = ranked[0].p;

  // Reveal the top contact's email.
  const matchResp = await fetch(`${APOLLO_API_URL}/people/match`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'x-api-key': APOLLO_API_KEY },
    body: JSON.stringify({ id: top.id, reveal_personal_emails: true }),
  });
  const person = matchResp.ok ? (await matchResp.json()).person || {} : {};
  const email = person.email || (person.personal_emails && person.personal_emails[0]) || top.email || '';
  if (!email || /email_not_unlocked|domain\.com/i.test(email)) return null;

  return {
    name: person.name || `${person.first_name || top.first_name || ''} ${person.last_name || top.last_name || ''}`.trim(),
    email,
    title: person.title || top.title || null,
    phone: person.phone_numbers?.[0]?.raw_number || person.sanitized_phone || null,
    linkedinUrl: person.linkedin_url || top.linkedin_url || null,
  };
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-webhook-secret');
  if (WEBHOOK_SECRET && secret !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const action = body.action;

  try {
    if (action === 'apollo') {
      const { city, state } = body;
      const perPage = Math.min(Math.max(Number(body.perPage) || 15, 1), 50);
      if (!city || !state) {
        return NextResponse.json({ error: 'city and state required' }, { status: 400 });
      }
      const contacts = await apolloDiscovery(city, state, perPage);
      return NextResponse.json({ contacts });
    }

    if (action === 'maps') {
      const { city, state, ll } = body;
      const maxQueries = Math.min(Math.max(Number(body.maxQueries) || 4, 1), 5);
      if (!city || !state) {
        return NextResponse.json({ error: 'city and state required' }, { status: 400 });
      }
      const { firms, searchesRun } = await searchGoogleMapsPMs(city, state, ll, maxQueries);
      return NextResponse.json({ firms, searchesRun });
    }

    if (action === 'enrich-domain') {
      const domain = String(body.domain || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
      if (!domain) return NextResponse.json({ error: 'domain required' }, { status: 400 });
      const contact = await apolloEnrichByDomain(domain);
      return NextResponse.json({ contact });
    }

    if (action === 'hasdata') {
      const { zillowUrl } = body;
      if (!zillowUrl) return NextResponse.json({ error: 'zillowUrl required' }, { status: 400 });
      const p = await lookupProperty(zillowUrl);
      const agent = {
        ownerName: p.agentName || p.brokerName || null,
        ownerEmail: (p.agentEmails && p.agentEmails[0]) || null,
        ownerPhone: p.agentPhone || p.brokerPhone || null,
        agentName: p.agentName || null,
        brokerName: p.brokerName || null,
        website: null as string | null,
      };
      return NextResponse.json({ agent });
    }

    return NextResponse.json({ error: `unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    console.error('[pm-discovery] error:', err?.message || err);
    return NextResponse.json({ error: err?.message || 'pm-discovery failed' }, { status: 502 });
  }
}
