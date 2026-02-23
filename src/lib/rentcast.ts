// RentCast API client for stale listing discovery
// Docs: https://developers.rentcast.io/reference

const RENTCAST_API_KEY = process.env.RENTCAST_API_KEY || '';
const BASE_URL = 'https://api.rentcast.io/v1';

export interface RentCastListing {
  id: string;
  formattedAddress: string;
  addressLine1: string;
  city: string;
  state: string;
  zipCode: string;
  county: string;
  latitude: number;
  longitude: number;
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  squareFootage: number;
  price: number;
  listingType: string;
  listedDate: string;
  lastSeenDate: string;
  daysOnMarket: number;
  status: string;
  removedDate?: string;
  createdDate: string;
}

export interface RentCastProperty {
  id: string;
  formattedAddress: string;
  city: string;
  state: string;
  zipCode: string;
  ownerName?: string;
  ownerType?: string;
  ownerOccupied?: boolean;
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  squareFootage: number;
  yearBuilt: number;
  assessedValue?: number;
  marketValue?: number;
}

export interface RentCastMarketData {
  zipCode: string;
  city: string;
  state: string;
  averageRent: number;
  medianRent: number;
  averageRentPerSqFt: number;
  rentalListings: number;
}

interface SearchListingsParams {
  city: string;
  state: string;
  minDaysOnMarket?: number;
  propertyType?: string;
  limit?: number;
  status?: string;
}

async function rentcastFetch(endpoint: string, params: Record<string, string> = {}): Promise<any> {
  const url = new URL(`${BASE_URL}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v) url.searchParams.set(k, v);
  });

  const res = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
      'X-Api-Key': RENTCAST_API_KEY,
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`RentCast API error ${res.status}: ${err}`);
  }

  return res.json();
}

export async function searchListings(params: SearchListingsParams): Promise<RentCastListing[]> {
  const { city, state, minDaysOnMarket = 30, propertyType, limit = 50, status = 'Active' } = params;

  const data = await rentcastFetch('/listings/rental/long-term', {
    city,
    state,
    status,
    propertyType: propertyType || '',
    limit: String(limit),
  });

  // RentCast returns an array of listings
  const listings: RentCastListing[] = Array.isArray(data) ? data : [];

  // Filter by minimum days on market
  return listings.filter(l => {
    const dom = l.daysOnMarket || calculateDOM(l.listedDate);
    return dom >= minDaysOnMarket;
  });
}

export async function getPropertyDetails(address: string): Promise<RentCastProperty | null> {
  try {
    const data = await rentcastFetch('/properties', { address });
    // Returns array, take first match
    const properties = Array.isArray(data) ? data : [];
    return properties[0] || null;
  } catch {
    return null;
  }
}

export async function getMarketData(zipCode: string): Promise<RentCastMarketData | null> {
  try {
    const data = await rentcastFetch('/markets', { zipCode });
    return data || null;
  } catch {
    return null;
  }
}

// Classify owner as individual or corporate based on name patterns
export function classifyOwnerType(name: string | null | undefined): 'individual' | 'corporate' | 'unknown' {
  if (!name) return 'unknown';
  const upper = name.toUpperCase();
  const corporatePatterns = [
    'LLC', 'L.L.C', 'INC', 'CORP', 'LTD', 'LP', 'L.P.',
    'TRUST', 'PARTNERSHIP', 'ASSOCIATES', 'HOLDINGS',
    'PROPERTIES', 'REALTY', 'MANAGEMENT', 'INVESTMENTS',
    'CAPITAL', 'GROUP', 'VENTURES', 'FUND', 'REIT',
    'EQUITY', 'RESIDENTIAL', 'APARTMENT', 'HOUSING',
  ];
  for (const pattern of corporatePatterns) {
    if (upper.includes(pattern)) return 'corporate';
  }
  return 'individual';
}

// Calculate days on market from listed date
function calculateDOM(listedDate: string | null | undefined): number {
  if (!listedDate) return 0;
  const listed = new Date(listedDate);
  const now = new Date();
  const diffMs = now.getTime() - listed.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

// Calculate estimated vacancy cost
export function calculateVacancyCost(monthlyRent: number, daysOnMarket: number): number {
  const dailyRent = monthlyRent / 30;
  return Math.round(dailyRent * daysOnMarket);
}
