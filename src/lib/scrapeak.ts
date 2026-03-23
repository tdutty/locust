/**
 * Scrapeak Zillow API client.
 * Returns up to 41 rental listings per search with photos, prices, phone numbers.
 * Docs: https://docs.scrapeak.com/zillow-scraper/overview
 */

const SCRAPEAK_API_KEY = process.env.SCRAPEAK_API_KEY || '';
const BASE_URL = 'https://app.scrapeak.com/v1/scrapers/zillow';

export interface ScrappeakListing {
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
  buildingName: string | null;
  phone: string | null;
  units: Array<{ price: string; beds: string }>;
  flexRecs: Array<{ displayString: string; contentType: string }>;
  zovInsight: { displayString: string; amenityType: string } | null;
}

interface SearchParams {
  city: string;
  state: string;
  regionId?: number;
  bedrooms?: number;
  maxPrice?: number;
  minPrice?: number;
}

/**
 * Get Zillow region ID for a city.
 */
export async function getRegionId(city: string, state: string): Promise<number | null> {
  if (!SCRAPEAK_API_KEY) return null;

  try {
    const res = await fetch(
      `${BASE_URL}/locationSuggestions?api_key=${SCRAPEAK_API_KEY}&q=${encodeURIComponent(`${city} ${state}`)}`,
    );
    const data = await res.json();
    if (!data.is_success) return null;

    const cityResult = data.data?.results?.find(
      (r: any) => r.resultType === 'Region' && r.metaData?.regionType === 'city',
    );
    return cityResult?.metaData?.regionId || null;
  } catch {
    return null;
  }
}

/**
 * Search Zillow for rental listings via Scrapeak.
 * Returns ~41 listings per page with photos, prices, phone numbers.
 */
export async function searchRentals(params: SearchParams): Promise<ScrappeakListing[]> {
  if (!SCRAPEAK_API_KEY) {
    console.warn('[scrapeak] No API key configured');
    return [];
  }

  const { city, state, bedrooms, maxPrice, minPrice } = params;

  // Get region ID if not provided
  let regionId = params.regionId;
  if (!regionId) {
    regionId = await getRegionId(city, state) || undefined;
  }

  // Build Zillow search URL with filters
  const filterState: Record<string, unknown> = {
    isForRent: { value: true },
    isForSaleByAgent: { value: false },
    isForSaleByOwner: { value: false },
    isNewConstruction: { value: false },
    isComingSoon: { value: false },
    isAuction: { value: false },
    isForSaleForeclosure: { value: false },
  };

  if (bedrooms !== undefined) {
    filterState.beds = { min: bedrooms };
  }
  if (maxPrice !== undefined || minPrice !== undefined) {
    const price: Record<string, number> = {};
    if (minPrice) price.min = minPrice;
    if (maxPrice) price.max = maxPrice;
    filterState.price = price;
  }

  const searchQueryState: Record<string, unknown> = {
    isMapVisible: false,
    filterState,
  };

  if (regionId) {
    searchQueryState.regionSelection = [{ regionId, regionType: 6 }];
    // Approximate bounds — Scrapeak needs mapBounds for some queries
    searchQueryState.mapBounds = { north: 90, south: -90, east: 180, west: -180 };
  }

  const citySlug = city.toLowerCase().replace(/\s+/g, '-');
  const stateSlug = state.toLowerCase().replace(/\s+/g, '-');
  const zillowUrl = `https://www.zillow.com/${citySlug}-${stateSlug}/rentals/?searchQueryState=${encodeURIComponent(JSON.stringify(searchQueryState))}`;

  console.log(`[scrapeak] Searching ${city}, ${state} | ${bedrooms || 'any'}BR | max $${maxPrice || 'any'}`);

  try {
    const res = await fetch(
      `${BASE_URL}/listing?api_key=${SCRAPEAK_API_KEY}&url=${encodeURIComponent(zillowUrl)}`,
      { signal: AbortSignal.timeout(60000) },
    );

    const data = await res.json();

    if (!data.is_success) {
      console.warn(`[scrapeak] API error: ${data.message}`);
      return [];
    }

    const credits = data.info?.remaining_credits;
    console.log(`[scrapeak] Credits remaining: ${credits}`);

    // Monitor credits
    import('@/lib/credit-monitor').then(m => m.checkScrapeak(credits)).catch(() => {});

    const results = data.data?.cat1?.searchResults?.listResults || [];
    const totalAvailable = data.data?.categoryTotals?.cat1?.totalResultCount || results.length;
    console.log(`[scrapeak] Found ${results.length} listings (${totalAvailable} total available)`);

    return results.map((r: any) => parseResult(r, city, state)).filter(Boolean) as ScrappeakListing[];
  } catch (err: any) {
    console.error(`[scrapeak] Search failed: ${err.message}`);
    return [];
  }
}

function parseResult(r: any, defaultCity: string, defaultState: string): ScrappeakListing | null {
  if (!r) return null;

  // Extract price — handle "$1,245+" format from units or direct price
  let price = 0;
  if (r.unformattedPrice) {
    price = r.unformattedPrice;
  } else if (r.price) {
    price = typeof r.price === 'number' ? r.price : parseInt(String(r.price).replace(/[^0-9]/g, '')) || 0;
  } else if (r.units?.length > 0) {
    // Use cheapest unit price
    const unitPrices = r.units
      .map((u: any) => parseInt(String(u.price).replace(/[^0-9]/g, '')) || 0)
      .filter((p: number) => p > 0);
    price = unitPrices.length > 0 ? Math.min(...unitPrices) : 0;
  }

  // Extract bedrooms
  let bedrooms = r.beds || 0;
  if (!bedrooms && r.units?.length > 0) {
    bedrooms = parseInt(r.units[0].beds) || 0;
  }

  // Extract phone from CTA recommendations
  let phone: string | null = null;
  const ctas = r.listCardRecommendation?.ctaRecommendations || [];
  const phoneCta = ctas.find((c: any) => c.contentType === 'PHONE');
  if (phoneCta) {
    phone = phoneCta.displayString.replace(/[^0-9]/g, '');
  }

  // Extract photos
  const photos: string[] = [];
  if (r.imgSrc) photos.push(r.imgSrc);
  if (r.carouselPhotosComposable?.photoData) {
    const baseUrl = r.carouselPhotosComposable.baseUrl || 'https://photos.zillowstatic.com/fp/{photoKey}-p_e.jpg';
    for (const p of r.carouselPhotosComposable.photoData.slice(0, 10)) {
      if (p.photoKey) {
        photos.push(baseUrl.replace('{photoKey}', p.photoKey));
      }
    }
  }

  const detailUrl = r.detailUrl || '';

  return {
    zpid: String(r.zpid || r.id || ''),
    address: r.address || `${r.addressStreet || ''}, ${r.addressCity || defaultCity}, ${r.addressState || defaultState}`,
    streetAddress: r.addressStreet || r.address?.split(',')[0] || '',
    city: r.addressCity || defaultCity,
    state: r.addressState || defaultState,
    zipCode: r.addressZipcode || '',
    price,
    bedrooms,
    bathrooms: r.baths || 0,
    sqft: r.area || null,
    latitude: r.latLong?.latitude || 0,
    longitude: r.latLong?.longitude || 0,
    propertyType: r.buildingName ? 'Apartment' : 'Single Family',
    listingUrl: detailUrl.startsWith('http') ? detailUrl : `https://www.zillow.com${detailUrl}`,
    photos,
    daysOnZillow: r.daysOnZillow || 0,
    buildingName: r.buildingName || null,
    phone,
    units: (r.units || []).map((u: any) => ({ price: u.price, beds: u.beds })),
    flexRecs: (r.listCardRecommendation?.flexFieldRecommendations || []).map((f: any) => ({ displayString: f.displayString, contentType: f.contentType })),
    zovInsight: r.listCardRecommendation?.zovInsight ? { displayString: r.listCardRecommendation.zovInsight.displayString, amenityType: r.listCardRecommendation.zovInsight.amenityType } : null,
  };
}
