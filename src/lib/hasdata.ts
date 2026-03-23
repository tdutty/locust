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
