/**
 * HasData Zillow API — property details, agent/broker info.
 * Replaces Scrapeak for property enrichment.
 * Docs: https://docs.hasdata.com/apis/zillow/property
 *
 * Cost: 5 credits per successful request
 *
 * Response structure (from actual API):
 *   property.agentInfo: { agentName, agentPhoneNumber, brokerName, brokerPhoneNumber, agentEmails[] }
 *   property.resoData: { appliances, cooling, heating, flooring, laundryFeatures, parkingFeatures,
 *                        interiorFeatures, exteriorFeatures, hasPetsAllowed, bedrooms, bathrooms, ... }
 *   property.photos: string[] (direct Zillow CDN URLs)
 *   property.description: string
 *   property.schools: { nearbySchools[], assignedSchools[] }
 *   property.priceHistory: [{ date, price, event }]
 *   property.taxHistory: [{ time, taxPaid, value }]
 */

const HASDATA_API_KEY = process.env.HASDATA_API_KEY || '';

export interface HasDataPropertyResult {
  // Agent / Broker
  agentName: string | null;
  agentPhone: string | null;
  brokerName: string | null;
  brokerPhone: string | null;
  agentEmails: string[];

  // Property basics
  description: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  yearBuilt: number | null;
  homeType: string | null;
  status: string | null;

  // Pricing
  price: number | null;
  lastSoldPrice: number | null;
  zestimate: number | null;
  rentZestimate: number | null;
  daysOnZillow: number | null;

  // Location
  city: string | null;
  state: string | null;
  zipcode: string | null;
  county: string | null;
  neighborhood: string | null;
  latitude: number | null;
  longitude: number | null;

  // Photos
  photos: string[];

  // Amenities from resoData
  heating: string[];
  cooling: string[];
  laundry: string[];
  parking: string | null;
  parkingCapacity: number | null;
  flooring: string[];
  appliances: string[];
  petsAllowed: boolean | null;
  interiorFeatures: string[];
  exteriorFeatures: string[];
  communityFeatures: string[];
  securityFeatures: string[];
  view: string[];

  // HOA
  hoaFee: string | null;

  // Schools
  schools: Array<{ name: string; rating: number | null; grades: string; distance: number }>;

  // Building
  buildingName: string | null;
}

/**
 * Look up a Zillow property by URL using HasData API.
 * Returns agent info, description, amenities, photos, schools, pricing.
 */
export async function lookupProperty(zillowUrl: string): Promise<HasDataPropertyResult> {
  if (!HASDATA_API_KEY) {
    throw new Error('HASDATA_API_KEY not configured');
  }

  const resp = await fetch(
    `https://api.hasdata.com/scrape/zillow/property?url=${encodeURIComponent(zillowUrl)}&extractAgentEmails=true`,
    {
      method: 'GET',
      headers: { 'x-api-key': HASDATA_API_KEY },
      signal: AbortSignal.timeout(30000),
    }
  );

  if (!resp.ok) {
    const text = await resp.text();
    if (resp.status === 402 || resp.status === 403) {
      import('@/lib/credit-monitor').then(m => m.checkHasData(0)).catch(() => {});
    }
    throw new Error(`HasData API error ${resp.status}: ${text.slice(0, 200)}`);
  }

  const data = await resp.json();
  const p = data.property || {};
  const reso = p.resoData || {};
  const agent = p.agentInfo || {};
  const addr = p.address || {};
  const geo = p.geo || {};
  const zest = p.zestimate || {};

  // Filter agent emails — remove junk (youtube links, truncated emails, threads links)
  const validEmails = (agent.agentEmails || p.agentEmails || []).filter((e: string) =>
    e && e.includes('@') && !e.includes('//') && !e.includes('*') && e.includes('.')
  );

  const result: HasDataPropertyResult = {
    // Agent / Broker
    agentName: agent.agentName || null,
    agentPhone: agent.agentPhoneNumber || null,
    brokerName: agent.brokerName || null,
    brokerPhone: agent.brokerPhoneNumber || null,
    agentEmails: validEmails,

    // Property basics
    description: p.description || null,
    bedrooms: reso.bedrooms || p.beds || null,
    bathrooms: reso.bathrooms || p.baths || null,
    sqft: reso.livingArea ? parseInt(reso.livingArea) : (p.area?.livingArea || null),
    yearBuilt: reso.yearBuilt || p.yearBuilt || null,
    homeType: reso.homeType || p.homeType || null,
    status: p.status || p.trueStatus || null,

    // Pricing
    price: p.price || null,
    lastSoldPrice: p.lastSoldPrice || null,
    zestimate: zest.zestimate || null,
    rentZestimate: zest.rentZestimate || null,
    daysOnZillow: p.daysOnZillow || null,

    // Location
    city: addr.city || null,
    state: addr.state || null,
    zipcode: addr.zipcode || null,
    county: addr.county || null,
    neighborhood: addr.parentRegion || addr.subdivision || null,
    latitude: geo.latitude || null,
    longitude: geo.longitude || null,

    // Photos — direct Zillow CDN URLs as strings
    photos: (p.photos || []).filter((url: any) => typeof url === 'string'),

    // Amenities
    heating: toArray(reso.heating),
    cooling: toArray(reso.cooling),
    laundry: toArray(reso.laundryFeatures),
    parking: toArray(reso.parkingFeatures).join(', ') || null,
    parkingCapacity: reso.parkingCapacity || null,
    flooring: toArray(reso.flooring),
    appliances: toArray(reso.appliances),
    petsAllowed: reso.hasPetsAllowed ?? null,
    interiorFeatures: toArray(reso.interiorFeatures),
    exteriorFeatures: toArray(reso.exteriorFeatures),
    communityFeatures: toArray(reso.communityFeatures),
    securityFeatures: toArray(reso.securityFeatures),
    view: toArray(reso.view),

    // HOA
    hoaFee: reso.hoaFee || reso.associationFee || null,

    // Schools
    schools: (p.schools?.nearbySchools || []).map((s: any) => ({
      name: s.name || '',
      rating: s.rating || null,
      grades: s.grades || '',
      distance: s.distance || 0,
    })),

    // Building
    buildingName: reso.buildingName || null,
  };

  return result;
}

function toArray(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  if (typeof val === 'string') return val.split(',').map(s => s.trim()).filter(Boolean);
  return [];
}

// ---------------------------------------------------------------------------
// Google Maps local-business discovery (PropScout "maps" crawl source).
//
// Maps surfaces local property managers that Apollo's B2B graph misses
// (small/regional firms). We return the firm's name/phone/site/address;
// the main app crawls each firm's public site for a contact email and
// upserts PMCompany. Keeping the keyed Maps call here preserves the
// "providers live on Locust" split.
// Docs: https://docs.hasdata.com/apis/google-maps
// ---------------------------------------------------------------------------

export interface HasDataMapsFirm {
  title: string;
  phone: string | null;
  address: string | null;
  website: string | null;
  type: string | null;
  description: string | null;
  rating: number | null;
  reviews: number | null;
}

/** One Google Maps search. `ll` is an optional "@lat,lng,zoomz" hint. */
export async function searchGoogleMaps(query: string, ll?: string): Promise<HasDataMapsFirm[]> {
  if (!HASDATA_API_KEY) throw new Error('HASDATA_API_KEY not configured');

  const url = `https://api.hasdata.com/scrape/google-maps/search?q=${encodeURIComponent(query)}`
    + (ll ? `&ll=${encodeURIComponent(ll)}` : '');

  const resp = await fetch(url, {
    method: 'GET',
    headers: { 'x-api-key': HASDATA_API_KEY },
    signal: AbortSignal.timeout(40000),
  });

  if (!resp.ok) {
    const text = await resp.text();
    if (resp.status === 402 || resp.status === 403) {
      import('@/lib/credit-monitor').then(m => m.checkHasData(0)).catch(() => {});
    }
    throw new Error(`HasData Maps error ${resp.status}: ${text.slice(0, 200)}`);
  }

  const data = await resp.json();
  const local = data.localResults || [];
  return local
    .map((r: any): HasDataMapsFirm => ({
      title: r.title || '',
      phone: r.phone || null,
      address: r.address || null,
      website: r.website || null,
      type: r.type || null,
      description: r.description || null,
      rating: typeof r.rating === 'number' ? r.rating : null,
      reviews: typeof r.reviews === 'number' ? r.reviews : null,
    }))
    .filter((f: HasDataMapsFirm) => f.title);
}

/**
 * Look up a single business by name (+ location) on Google Maps and return
 * its website/phone. A specific-business query returns `placeResults` (the
 * knowledge panel), not the `localResults` list, so this reads that field.
 * Used to backfill websites for phone-only PMs.
 */
export async function lookupFirmWebsite(query: string, ll?: string): Promise<{ title: string | null; website: string | null; phone: string | null; address: string | null } | null> {
  if (!HASDATA_API_KEY) throw new Error('HASDATA_API_KEY not configured');
  const url = `https://api.hasdata.com/scrape/google-maps/search?q=${encodeURIComponent(query)}`
    + (ll ? `&ll=${encodeURIComponent(ll)}` : '');
  const resp = await fetch(url, { headers: { 'x-api-key': HASDATA_API_KEY }, signal: AbortSignal.timeout(40000) });
  if (!resp.ok) {
    if (resp.status === 402 || resp.status === 403) import('@/lib/credit-monitor').then(m => m.checkHasData(0)).catch(() => {});
    throw new Error(`HasData Maps error ${resp.status}`);
  }
  const data = await resp.json();
  const pr = data.placeResults || (Array.isArray(data.localResults) ? data.localResults[0] : null);
  if (!pr) return null;
  return { title: pr.title || null, website: pr.website || null, phone: pr.phone || null, address: pr.address || null };
}

const PM_MAPS_QUERIES = (area: string): string[] => [
  `property management ${area}`,
  `single family home property management ${area}`,
  `residential property management ${area}`,
  `house rentals property manager ${area}`,
  `rental homes management company ${area}`,
];

/**
 * Run several query angles for one city, deduped by title+address. Maps
 * caps each query at ~20 results, so multiple angles widen coverage.
 * Counts each completed query as one "search" for credit accounting.
 * Throws only if every query failed (so the caller can DLQ the city).
 */
export async function searchGoogleMapsPMs(
  city: string,
  state: string,
  ll?: string,
  maxQueries = 4,
): Promise<{ firms: HasDataMapsFirm[]; searchesRun: number }> {
  const area = `${city} ${state}`.trim();
  const queries = PM_MAPS_QUERIES(area).slice(0, Math.max(1, Math.min(maxQueries, 5)));

  const settled = await Promise.allSettled(queries.map(q => searchGoogleMaps(q, ll)));
  const byKey = new Map<string, HasDataMapsFirm>();
  const errors: string[] = [];
  let searchesRun = 0;

  for (const s of settled) {
    if (s.status === 'fulfilled') {
      searchesRun++;
      for (const f of s.value) {
        const key = `${f.title}|${f.address || ''}`.toLowerCase();
        if (!byKey.has(key)) byKey.set(key, f);
      }
    } else {
      errors.push(s.reason instanceof Error ? s.reason.message : String(s.reason));
    }
  }

  if (searchesRun === 0) {
    throw new Error(`all ${queries.length} Maps queries failed: ${errors[0] || 'unknown error'}`);
  }
  return { firms: [...byKey.values()], searchesRun };
}
