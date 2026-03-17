/**
 * PropertyReach API client for skip tracing and portfolio detection.
 * Docs: https://docs.propertyreach.com
 *
 * All POST endpoints use { target: { streetAddress, city, state, zip } } format.
 * Returns owner names, phones, emails, linked properties (portfolio).
 */

const PROPERTYREACH_API_KEY = process.env.PROPERTYREACH_API_KEY || '';
const BASE_URL = 'https://api.propertyreach.com/v1';

interface PropertyReachTarget {
  streetAddress?: string;
  city?: string;
  state?: string;
  zip?: string;
  propertyId?: number;
}

export interface SkipTraceResult {
  found: boolean;
  persons: Array<{
    firstName: string;
    lastName: string;
    middleName?: string;
    deceased: boolean;
    emails: Array<{ email: string; lastReported?: string }>;
    phones: Array<{ phone: string; type: string; lastReported?: string }>;
  }>;
}

export interface LinkedProperty {
  id: number;
  streetAddress: string;
  city: string;
  state: string;
  zip: string;
  county?: string;
  landUse?: string;
  bedrooms?: number;
  bathrooms?: number;
  squareFeet?: number;
  estimatedValue?: number;
  loanBalance?: number;
  ownerNames?: string;
  ownershipMonths?: number;
  vacant?: boolean;
  primary?: boolean;
}

export interface LinkedPropertiesResult {
  found: boolean;
  properties: LinkedProperty[];
  portfolioSize: number;
  ownerName: string | null;
}

async function propertyReachFetch(endpoint: string, target: PropertyReachTarget): Promise<any> {
  if (!PROPERTYREACH_API_KEY) {
    console.warn('PropertyReach API key not configured');
    return null;
  }

  const res = await fetch(`${BASE_URL}/${endpoint}`, {
    method: 'POST',
    headers: {
      'x-api-key': PROPERTYREACH_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ target }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`PropertyReach ${endpoint} error ${res.status}: ${text}`);
    return null;
  }

  const data = await res.json();
  if (data.meta?.status !== 200) {
    return null;
  }

  return data;
}

/**
 * Skip trace a property address to find owner contact info.
 * Returns persons with names, emails, and phone numbers.
 */
export async function skipTrace(
  streetAddress: string,
  city: string,
  state: string,
  zip: string,
): Promise<SkipTraceResult> {
  const data = await propertyReachFetch('skip-trace', { streetAddress, city, state, zip });

  if (!data || !data.persons?.length) {
    return { found: false, persons: [] };
  }

  return {
    found: true,
    persons: data.persons.map((p: any) => ({
      firstName: p.firstName || '',
      lastName: p.lastName || '',
      middleName: p.middleName || undefined,
      deceased: p.deceased || false,
      emails: (p.emails || []).map((e: any) => ({
        email: e.email,
        lastReported: e.lastReported,
      })),
      phones: (p.phones || []).map((ph: any) => ({
        phone: ph.phone,
        type: ph.type || 'Unknown',
        lastReported: ph.lastReported,
      })),
    })),
  };
}

/**
 * Find all properties linked to the same owner as the given address.
 * Use this for portfolio detection — a landlord owning 10 properties
 * is a much better outreach target than one with a single unit.
 */
export async function getLinkedProperties(
  streetAddress: string,
  city: string,
  state: string,
  zip: string,
): Promise<LinkedPropertiesResult> {
  const data = await propertyReachFetch('linked-properties', { streetAddress, city, state, zip });

  if (!data || !data.properties?.length) {
    return { found: false, properties: [], portfolioSize: 0, ownerName: null };
  }

  const properties: LinkedProperty[] = data.properties.map((p: any) => ({
    id: p.id,
    streetAddress: p.streetAddress,
    city: p.city,
    state: p.state,
    zip: p.zip,
    county: p.county,
    landUse: p.landUse,
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    squareFeet: p.squareFeet,
    estimatedValue: p.estimatedValue,
    loanBalance: p.loanBalance,
    ownerNames: p.ownerNames,
    ownershipMonths: p.ownershipMonths,
    vacant: p.vacant,
    primary: p.primary,
  }));

  return {
    found: true,
    properties,
    portfolioSize: properties.length,
    ownerName: properties[0]?.ownerNames || null,
  };
}

/**
 * Combined enrichment: skip trace + linked properties in one call.
 * Returns the best owner contact (most recent email/phone) plus portfolio size.
 */
export async function enrichProperty(
  streetAddress: string,
  city: string,
  state: string,
  zip: string,
): Promise<{
  ownerName: string | null;
  ownerEmail: string | null;
  ownerPhone: string | null;
  ownerType: 'individual' | 'corporate' | 'unknown';
  portfolioSize: number;
  estimatedValue: number | null;
}> {
  const [skipTraceResult, linkedResult] = await Promise.all([
    skipTrace(streetAddress, city, state, zip),
    getLinkedProperties(streetAddress, city, state, zip),
  ]);

  let ownerName: string | null = null;
  let ownerEmail: string | null = null;
  let ownerPhone: string | null = null;

  // Get best contact from skip trace (first non-deceased person with most recent data)
  if (skipTraceResult.found) {
    const livePerson = skipTraceResult.persons.find(p => !p.deceased);
    if (livePerson) {
      ownerName = `${livePerson.firstName} ${livePerson.lastName}`.trim();

      // Most recent email
      const sortedEmails = [...livePerson.emails].sort((a, b) =>
        (b.lastReported || '').localeCompare(a.lastReported || '')
      );
      ownerEmail = sortedEmails[0]?.email || null;

      // Most recent mobile phone (prefer mobile over landline)
      const mobilePhones = livePerson.phones.filter(p => p.type === 'Mobile');
      const sortedPhones = (mobilePhones.length > 0 ? mobilePhones : livePerson.phones)
        .sort((a, b) => (b.lastReported || '').localeCompare(a.lastReported || ''));
      ownerPhone = sortedPhones[0]?.phone || null;
    }
  }

  // Fall back to linked properties for owner name
  if (!ownerName && linkedResult.ownerName) {
    ownerName = linkedResult.ownerName;
  }

  // Determine owner type
  let ownerType: 'individual' | 'corporate' | 'unknown' = 'unknown';
  if (ownerName) {
    const upper = ownerName.toUpperCase();
    const corporatePatterns = ['LLC', 'L.L.C', 'INC', 'CORP', 'LTD', 'LP', 'TRUST', 'PARTNERSHIP', 'HOLDINGS', 'PROPERTIES', 'REALTY', 'MANAGEMENT'];
    ownerType = corporatePatterns.some(p => upper.includes(p)) ? 'corporate' : 'individual';
  }

  return {
    ownerName,
    ownerEmail,
    ownerPhone,
    ownerType,
    portfolioSize: linkedResult.portfolioSize,
    estimatedValue: linkedResult.properties[0]?.estimatedValue || null,
  };
}
