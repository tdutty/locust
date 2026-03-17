/**
 * Zillow rental search scraper.
 * Scrapes Zillow search results page to find rental listings by city, bedrooms, budget.
 * Extracts listing data from __NEXT_DATA__ JSON embedded in the page.
 */

const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY || '';

const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
];

function randomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

export interface ZillowSearchListing {
  zpid: string;
  address: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  sqft: number | null;
  latitude: number;
  longitude: number;
  propertyType: string | null;
  listingUrl: string;
  photos: string[];
  daysOnZillow: number;
  listingAgent: string | null;
  listingPhone: string | null;
  brokerName: string | null;
  buildingName: string | null;
}

interface ZillowSearchParams {
  city: string;
  state: string;
  bedrooms?: number;
  maxPrice?: number;
  minPrice?: number;
  limit?: number;
}

function buildSearchUrl(params: ZillowSearchParams): string {
  const { city, state, bedrooms, maxPrice, minPrice } = params;
  const citySlug = city.toLowerCase().replace(/\s+/g, '-');
  const stateSlug = state.toLowerCase().replace(/\s+/g, '-');

  // Build Zillow filter state
  const filterState: Record<string, unknown> = {
    fr: { value: true },     // for rent
    fsba: { value: false },  // not for sale by agent
    fsbo: { value: false },  // not for sale by owner
    nc: { value: false },    // not new construction
    cmsn: { value: false },  // not coming soon
    auc: { value: false },   // not auction
    fore: { value: false },  // not foreclosure
  };

  if (bedrooms !== undefined) {
    filterState.beds = { min: bedrooms, max: bedrooms };
  }
  if (maxPrice !== undefined || minPrice !== undefined) {
    const priceFilter: Record<string, number> = {};
    if (minPrice !== undefined) priceFilter.min = minPrice;
    if (maxPrice !== undefined) priceFilter.max = maxPrice;
    filterState.price = priceFilter;
  }

  const searchQuery = {
    pagination: {},
    isMapVisible: false,
    filterState,
  };

  const encoded = encodeURIComponent(JSON.stringify(searchQuery));
  return `https://www.zillow.com/${citySlug}-${stateSlug}/rentals/?searchQueryState=${encoded}`;
}

function extractListingsFromHtml(html: string): ZillowSearchListing[] {
  const listings: ZillowSearchListing[] = [];

  try {
    // Extract from __NEXT_DATA__ JSON
    const nextDataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!nextDataMatch) {
      console.warn('[zillow-search] No __NEXT_DATA__ found');
      return listings;
    }

    const json = JSON.parse(nextDataMatch[1]);
    const searchStr = JSON.stringify(json);

    // Find the search results in the nested JSON
    // Zillow stores them in various paths — try to find the listResults or searchResults
    const results = findSearchResults(json);

    for (const result of results) {
      try {
        const listing = parseZillowResult(result);
        if (listing) listings.push(listing);
      } catch {
        // Skip unparseable results
      }
    }

    // Fallback: regex extract zpid + basic data from the JSON string
    if (listings.length === 0) {
      const zpidPattern = /"zpid":"?(\d+)"?[^}]*"address":"([^"]+)"[^}]*"price":(\d+)/g;
      let match;
      while ((match = zpidPattern.exec(searchStr)) !== null && listings.length < 50) {
        listings.push({
          zpid: match[1],
          address: match[2],
          streetAddress: match[2].split(',')[0],
          city: '',
          state: '',
          zipCode: '',
          price: parseInt(match[3]),
          bedrooms: 0,
          bathrooms: 0,
          sqft: null,
          latitude: 0,
          longitude: 0,
          propertyType: null,
          listingUrl: `https://www.zillow.com/homedetails/${match[1]}_zpid/`,
          photos: [],
          daysOnZillow: 0,
          listingAgent: null,
          listingPhone: null,
          brokerName: null,
          buildingName: null,
        });
      }
    }
  } catch (err) {
    console.error('[zillow-search] Failed to parse HTML:', err);
  }

  return listings;
}

function findSearchResults(json: any): any[] {
  // Navigate the Zillow __NEXT_DATA__ structure
  try {
    // Path 1: props.pageProps.searchPageState.cat1.searchResults.listResults
    const listResults = json?.props?.pageProps?.searchPageState?.cat1?.searchResults?.listResults;
    if (Array.isArray(listResults) && listResults.length > 0) return listResults;

    // Path 2: props.pageProps.searchPageState.cat1.searchResults.mapResults
    const mapResults = json?.props?.pageProps?.searchPageState?.cat1?.searchResults?.mapResults;
    if (Array.isArray(mapResults) && mapResults.length > 0) return mapResults;

    // Path 3: Deep search for any array with zpid objects
    const found = deepFindArray(json, 'zpid', 3);
    if (found.length > 0) return found;
  } catch {
    // Structure changed
  }

  return [];
}

function deepFindArray(obj: any, key: string, maxDepth: number): any[] {
  if (maxDepth <= 0 || !obj || typeof obj !== 'object') return [];

  if (Array.isArray(obj)) {
    if (obj.length > 0 && obj[0]?.[key]) return obj;
    for (const item of obj) {
      const found = deepFindArray(item, key, maxDepth - 1);
      if (found.length > 0) return found;
    }
  } else {
    for (const val of Object.values(obj)) {
      const found = deepFindArray(val, key, maxDepth - 1);
      if (found.length > 0) return found;
    }
  }

  return [];
}

function parseZillowResult(result: any): ZillowSearchListing | null {
  const zpid = result.zpid || result.id;
  if (!zpid) return null;

  const price = result.unformattedPrice || result.price || result.units?.[0]?.price || 0;
  if (typeof price === 'string' && price.includes('+')) return null; // Skip "From $X+" multi-unit

  const addr = result.address || result.addressStreet || '';
  const detailUrl = result.detailUrl || result.hdpUrl || '';

  // Extract photos
  const photos: string[] = [];
  if (result.imgSrc) photos.push(result.imgSrc);
  if (result.carouselPhotos) {
    for (const p of result.carouselPhotos) {
      if (p.url) photos.push(p.url);
    }
  }

  return {
    zpid: String(zpid),
    address: addr || `${result.streetAddress || ''}, ${result.city || ''}, ${result.state || ''} ${result.zipcode || ''}`,
    streetAddress: result.streetAddress || result.addressStreet || addr.split(',')[0] || '',
    city: result.city || result.addressCity || '',
    state: result.state || result.addressState || '',
    zipCode: result.zipcode || result.addressZipcode || '',
    price: typeof price === 'number' ? price : parseInt(String(price).replace(/[^0-9]/g, '')) || 0,
    bedrooms: result.beds || result.bedrooms || 0,
    bathrooms: result.baths || result.bathrooms || 0,
    sqft: result.area || result.livingArea || null,
    latitude: result.latLong?.latitude || result.latitude || 0,
    longitude: result.latLong?.longitude || result.longitude || 0,
    propertyType: result.hdpData?.homeInfo?.homeType || result.propertyType || null,
    listingUrl: detailUrl.startsWith('http') ? detailUrl : `https://www.zillow.com${detailUrl}`,
    photos,
    daysOnZillow: result.daysOnZillow || 0,
    listingAgent: result.brokerName || null,
    listingPhone: null,
    brokerName: result.brokerName || null,
    buildingName: result.buildingName || null,
  };
}

/**
 * Search Zillow for rental listings in a city with optional filters.
 */
export async function searchZillowRentals(params: ZillowSearchParams): Promise<ZillowSearchListing[]> {
  const searchUrl = buildSearchUrl(params);
  const limit = params.limit || 40;

  console.log(`[zillow-search] Searching: ${params.city}, ${params.state} | ${params.bedrooms || 'any'}BR | max $${params.maxPrice || 'any'}`);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const controller = new AbortController();
      const useProxy = !!SCRAPER_API_KEY;
      const timeoutMs = useProxy ? 45000 : 15000;
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      let fetchUrl: string;
      const headers: Record<string, string> = {
        'User-Agent': randomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      };

      if (useProxy) {
        fetchUrl = `https://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(searchUrl)}&render=false`;
      } else {
        fetchUrl = searchUrl;
      }

      const res = await fetch(fetchUrl, {
        headers: useProxy ? undefined : headers,
        signal: controller.signal,
        redirect: 'follow',
      });
      clearTimeout(timeout);

      if (!res.ok) {
        console.warn(`[zillow-search] HTTP ${res.status} on attempt ${attempt + 1}`);
        continue;
      }

      const html = await res.text();
      const listings = extractListingsFromHtml(html);

      console.log(`[zillow-search] Found ${listings.length} listings`);

      // Filter by price/bedrooms if Zillow returned extras
      const filtered = listings.filter(l => {
        if (params.bedrooms !== undefined && l.bedrooms !== params.bedrooms && l.bedrooms !== 0) return false;
        if (params.maxPrice !== undefined && l.price > params.maxPrice && l.price > 0) return false;
        if (params.minPrice !== undefined && l.price < params.minPrice && l.price > 0) return false;
        return l.price > 0;
      });

      return filtered.slice(0, limit);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.warn(`[zillow-search] Timeout on attempt ${attempt + 1}`);
      } else {
        console.error(`[zillow-search] Error on attempt ${attempt + 1}:`, err.message);
      }
    }
  }

  return [];
}
