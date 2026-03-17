/**
 * City Scan — builds a market inventory index for a city.
 *
 * Pulls 5 pages from Scrapeak (~200 listings), groups by building/owner,
 * enriches top portfolio landlords via PropertyReach, stores in DB.
 *
 * Run once per city. After that, tenant matches query the DB — no API calls.
 */

import { query } from '@/lib/db';
import { searchRentals, getRegionId, ScrappeakListing } from '@/lib/scrapeak';
import { enrichProperty, getLinkedProperties } from '@/lib/propertyreach';

const SCRAPEAK_API_KEY = process.env.SCRAPEAK_API_KEY || '';
// Max 20 pages per scan — Zillow caps at ~page 20 anyway
// Each page = 41 listings × 10 credits = ~820 listings for 200 credits
const PAGES_TO_SCAN = 20;

interface BuildingGroup {
  buildingName: string;
  listings: ScrappeakListing[];
  unitCount: number;
  priceRange: { min: number; max: number };
  phone: string | null;
  sampleAddress: { street: string; city: string; state: string; zip: string };
}

interface ScanResult {
  city: string;
  state: string;
  totalListingsScraped: number;
  uniqueBuildings: number;
  individualListings: number;
  portfolioLandlords: number;
  enrichedCount: number;
  creditsUsed: number;
}

/**
 * Scan a city's rental market and build an indexed inventory.
 */
export async function scanCity(city: string, state: string, bedroomsMin?: number): Promise<ScanResult> {
  console.log(`[city-scan] Starting scan: ${city}, ${state}`);

  // Get region ID for pagination
  const regionId = await getRegionId(city, state);
  if (!regionId) {
    console.error(`[city-scan] Could not find region ID for ${city}, ${state}`);
    return { city, state, totalListingsScraped: 0, uniqueBuildings: 0, individualListings: 0, portfolioLandlords: 0, enrichedCount: 0, creditsUsed: 0 };
  }

  // Create or update city scan record
  await query(
    `INSERT INTO city_scans (city, state, region_id, status, started_at)
     VALUES ($1, $2, $3, 'scanning', NOW())
     ON CONFLICT (city, state) DO UPDATE SET status = 'scanning', started_at = NOW(), updated_at = NOW()`,
    [city, state, regionId]
  ).catch(() => {
    // Table might not exist — create it
    return query(`
      CREATE TABLE IF NOT EXISTS city_scans (
        id SERIAL PRIMARY KEY,
        city TEXT NOT NULL,
        state TEXT NOT NULL,
        region_id INT,
        status TEXT DEFAULT 'pending',
        total_listings INT DEFAULT 0,
        unique_buildings INT DEFAULT 0,
        portfolio_landlords INT DEFAULT 0,
        enriched_count INT DEFAULT 0,
        credits_used INT DEFAULT 0,
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(city, state)
      )
    `).then(() => query(
      `INSERT INTO city_scans (city, state, region_id, status, started_at)
       VALUES ($1, $2, $3, 'scanning', NOW())
       ON CONFLICT (city, state) DO UPDATE SET status = 'scanning', started_at = NOW(), updated_at = NOW()`,
      [city, state, regionId]
    ));
  });

  // Ensure portfolio_landlords table exists
  await query(`
    CREATE TABLE IF NOT EXISTS portfolio_landlords (
      id SERIAL PRIMARY KEY,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      owner_name TEXT,
      owner_email TEXT,
      owner_phone TEXT,
      owner_type TEXT,
      building_name TEXT,
      unit_count INT DEFAULT 0,
      portfolio_size INT DEFAULT 0,
      price_min REAL,
      price_max REAL,
      estimated_value REAL,
      sample_address TEXT,
      listing_phone TEXT,
      listing_ids INT[],
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(city, state, COALESCE(building_name, ''), COALESCE(owner_name, ''))
    )
  `).catch(() => {});

  // Pull multiple pages from Scrapeak
  const allListings: ScrappeakListing[] = [];
  let creditsUsed = 0;

  // Build the base slug — handle multi-word cities and state abbreviations
  const citySlug = city.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const stateSlug = state.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const baseSlug = `${citySlug}-${stateSlug}`;

  for (let page = 1; page <= PAGES_TO_SCAN; page++) {
    console.log(`[city-scan] Fetching page ${page}/${PAGES_TO_SCAN}...`);

    const filterState: Record<string, unknown> = {
      isForRent: { value: true },
      isForSaleByAgent: { value: false },
      isForSaleByOwner: { value: false },
      isNewConstruction: { value: false },
      isComingSoon: { value: false },
      isAuction: { value: false },
      isForSaleForeclosure: { value: false },
    };
    if (bedroomsMin) filterState.beds = { min: bedroomsMin };

    const searchQueryState: Record<string, unknown> = {
      pagination: page > 1 ? { currentPage: page } : {},
      isMapVisible: true,
      mapBounds: { north: 90, south: -90, east: 180, west: -180 },
      regionSelection: [{ regionId, regionType: 6 }],
      filterState,
      isListVisible: true,
    };

    // Use the regionId-based URL — more reliable than city slug for multi-word cities
    const zillowUrl = `https://www.zillow.com/${baseSlug}/rentals/${page > 1 ? `${page}_p/` : ''}?searchQueryState=${encodeURIComponent(JSON.stringify(searchQueryState))}`;

    try {
      const res = await fetch(
        `https://app.scrapeak.com/v1/scrapers/zillow/listing?api_key=${SCRAPEAK_API_KEY}&url=${encodeURIComponent(zillowUrl)}`,
        { signal: AbortSignal.timeout(60000) },
      );
      const data = await res.json();
      creditsUsed += 10;

      if (!data.is_success) {
        console.warn(`[city-scan] Page ${page} failed: ${data.message}. Credits remaining: ${data.info?.remaining_credits}`);
        break;
      }

      const results: any[] = data.data?.cat1?.searchResults?.listResults || [];
      const totalAvailable = data.data?.categoryTotals?.cat1?.totalResultCount;

      if (page === 1) {
        console.log(`[city-scan] ${city}, ${state}: ${totalAvailable} total listings available on Zillow`);
      }

      if (results.length === 0) {
        console.log(`[city-scan] No more results at page ${page}. Credits remaining: ${data.info?.remaining_credits}`);
        break;
      }

      // Parse results
      for (const r of results) {
        const phone = r.listCardRecommendation?.ctaRecommendations?.find((c: any) => c.contentType === 'PHONE')?.displayString?.replace(/[^0-9]/g, '') || null;
        const unitPrices = (r.units || []).map((u: any) => parseInt(String(u.price).replace(/[^0-9]/g, '')) || 0).filter((p: number) => p > 0);
        const price = r.unformattedPrice || (unitPrices.length > 0 ? Math.min(...unitPrices) : 0);

        allListings.push({
          zpid: String(r.zpid || r.id || ''),
          address: r.address || '',
          streetAddress: r.addressStreet || r.address?.split(',')[0] || '',
          city: r.addressCity || city,
          state: r.addressState || state,
          zipCode: r.addressZipcode || '',
          price: typeof price === 'number' ? price : parseInt(String(price).replace(/[^0-9]/g, '')) || 0,
          bedrooms: r.beds || (r.units?.[0]?.beds ? parseInt(r.units[0].beds) : 0),
          bathrooms: r.baths || 0,
          sqft: r.area || null,
          latitude: r.latLong?.latitude || 0,
          longitude: r.latLong?.longitude || 0,
          propertyType: r.buildingName ? 'Apartment' : 'Single Family',
          listingUrl: (r.detailUrl || '').startsWith('http') ? r.detailUrl : `https://www.zillow.com${r.detailUrl || ''}`,
          photos: r.imgSrc ? [r.imgSrc] : [],
          daysOnZillow: r.daysOnZillow || 0,
          buildingName: r.buildingName || null,
          phone,
          units: (r.units || []).map((u: any) => ({ price: u.price, beds: u.beds })),
          flexRecs: (r.listCardRecommendation?.flexFieldRecommendations || []),
          zovInsight: r.listCardRecommendation?.zovInsight || null,
        });
      }

      console.log(`[city-scan] Page ${page}: ${results.length} listings (total: ${allListings.length})`);

      // Rate limit between pages
      if (page < PAGES_TO_SCAN) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (err: any) {
      console.error(`[city-scan] Page ${page} error: ${err.message}`);
      break;
    }
  }

  console.log(`[city-scan] Scraped ${allListings.length} total listings`);

  // Group by building name (apartment complexes = portfolio landlords)
  const buildings = new Map<string, BuildingGroup>();
  const individualListings: ScrappeakListing[] = [];

  for (const listing of allListings) {
    if (listing.buildingName) {
      const key = listing.buildingName.toLowerCase().trim();
      if (!buildings.has(key)) {
        buildings.set(key, {
          buildingName: listing.buildingName,
          listings: [],
          unitCount: 0,
          priceRange: { min: Infinity, max: 0 },
          phone: listing.phone,
          sampleAddress: {
            street: listing.streetAddress,
            city: listing.city,
            state: listing.state,
            zip: listing.zipCode,
          },
        });
      }
      const group = buildings.get(key)!;
      group.listings.push(listing);
      group.unitCount += listing.units.length || 1;
      if (listing.price > 0 && listing.price < group.priceRange.min) group.priceRange.min = listing.price;
      if (listing.price > group.priceRange.max) group.priceRange.max = listing.price;
      if (!group.phone && listing.phone) group.phone = listing.phone;
    } else {
      individualListings.push(listing);
    }
  }

  // Sort buildings by unit count (biggest portfolios first)
  const sortedBuildings = [...buildings.values()].sort((a, b) => b.unitCount - a.unitCount);

  console.log(`[city-scan] Found ${sortedBuildings.length} apartment complexes, ${individualListings.length} individual listings`);
  console.log(`[city-scan] Top buildings: ${sortedBuildings.slice(0, 5).map(b => `${b.buildingName} (${b.unitCount} units)`).join(', ')}`);

  // Enrich top buildings via PropertyReach
  let enrichedCount = 0;
  const topBuildings = sortedBuildings.slice(0, 30); // Top 30 portfolio landlords

  for (const building of topBuildings) {
    try {
      const addr = building.sampleAddress;
      const enriched = await enrichProperty(addr.street, addr.city, addr.state, addr.zip);

      // Upsert into portfolio_landlords table
      await query(
        `INSERT INTO portfolio_landlords (city, state, owner_name, owner_email, owner_phone, owner_type, building_name, unit_count, portfolio_size, price_min, price_max, estimated_value, sample_address, listing_phone)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (city, state, COALESCE(building_name, ''), COALESCE(owner_name, ''))
         DO UPDATE SET owner_email = COALESCE($4, portfolio_landlords.owner_email),
           owner_phone = COALESCE($5, portfolio_landlords.owner_phone),
           unit_count = $8, portfolio_size = COALESCE($9, portfolio_landlords.portfolio_size),
           price_min = $10, price_max = $11,
           estimated_value = COALESCE($12, portfolio_landlords.estimated_value),
           listing_phone = COALESCE($14, portfolio_landlords.listing_phone),
           updated_at = NOW()`,
        [
          city, state,
          enriched.ownerName || building.buildingName,
          enriched.ownerEmail,
          enriched.ownerPhone,
          enriched.ownerType,
          building.buildingName,
          building.unitCount,
          enriched.portfolioSize || building.unitCount,
          building.priceRange.min === Infinity ? null : building.priceRange.min,
          building.priceRange.max || null,
          enriched.estimatedValue,
          `${addr.street}, ${addr.city}, ${addr.state} ${addr.zip}`,
          building.phone,
        ]
      );

      if (enriched.ownerEmail || enriched.ownerPhone) enrichedCount++;
      console.log(`[city-scan] Enriched ${building.buildingName}: ${enriched.ownerName || 'no owner'} | portfolio: ${enriched.portfolioSize} | ${enriched.ownerPhone || building.phone || 'no phone'}`);
    } catch (err: any) {
      console.warn(`[city-scan] Failed to enrich ${building.buildingName}: ${err.message}`);
    }
  }

  // Also enrich top individual listings (by days on market — more motivated)
  const topIndividuals = individualListings
    .filter(l => l.price > 0)
    .sort((a, b) => (b.daysOnZillow || 0) - (a.daysOnZillow || 0))
    .slice(0, 10);

  for (const listing of topIndividuals) {
    try {
      const enriched = await enrichProperty(listing.streetAddress, listing.city, listing.state, listing.zipCode);

      if (enriched.ownerName) {
        await query(
          `INSERT INTO portfolio_landlords (city, state, owner_name, owner_email, owner_phone, owner_type, building_name, unit_count, portfolio_size, price_min, price_max, estimated_value, sample_address, listing_phone)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10, $11, $12, $13)
           ON CONFLICT (city, state, COALESCE(building_name, ''), COALESCE(owner_name, ''))
           DO UPDATE SET owner_email = COALESCE($4, portfolio_landlords.owner_email),
             owner_phone = COALESCE($5, portfolio_landlords.owner_phone),
             portfolio_size = COALESCE($9, portfolio_landlords.portfolio_size),
             updated_at = NOW()`,
          [
            city, state,
            enriched.ownerName,
            enriched.ownerEmail,
            enriched.ownerPhone,
            enriched.ownerType,
            null, // no building name for individual
            1,
            enriched.portfolioSize,
            listing.price,
            enriched.estimatedValue,
            `${listing.streetAddress}, ${listing.city}, ${listing.state} ${listing.zipCode}`,
            listing.phone,
          ]
        );
        if (enriched.ownerEmail || enriched.ownerPhone) enrichedCount++;
      }
    } catch {
      // Continue
    }
  }

  // Also bulk-insert all scraped listings into the listings table
  for (const listing of allListings) {
    try {
      await query(
        `INSERT INTO listings (rentcast_id, address, city, state, zip_code, property_type, bedrooms, bathrooms, sqft, listed_price, days_on_market, latitude, longitude, source, zillow_url, zillow_photos, quality_score)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'zillow-scan', $14, $15, 0)
         ON CONFLICT (rentcast_id) DO UPDATE SET listed_price = $10, days_on_market = $11, updated_at = NOW()`,
        [
          `zillow-${listing.zpid}`,
          listing.address,
          listing.city || city,
          listing.state || state,
          listing.zipCode,
          listing.propertyType,
          listing.bedrooms,
          listing.bathrooms,
          listing.sqft,
          listing.price,
          listing.daysOnZillow,
          listing.latitude,
          listing.longitude,
          listing.listingUrl,
          listing.photos,
        ]
      );
    } catch {
      // Duplicate or schema mismatch — continue
    }
  }

  // Update scan record
  const result: ScanResult = {
    city,
    state,
    totalListingsScraped: allListings.length,
    uniqueBuildings: sortedBuildings.length,
    individualListings: individualListings.length,
    portfolioLandlords: topBuildings.length,
    enrichedCount,
    creditsUsed,
  };

  await query(
    `UPDATE city_scans SET
       status = 'completed',
       total_listings = $1,
       unique_buildings = $2,
       portfolio_landlords = $3,
       enriched_count = $4,
       credits_used = $5,
       completed_at = NOW(),
       updated_at = NOW()
     WHERE city = $6 AND state = $7`,
    [result.totalListingsScraped, result.uniqueBuildings, result.portfolioLandlords, result.enrichedCount, result.creditsUsed, city, state]
  );

  console.log(`[city-scan] Complete: ${JSON.stringify(result)}`);
  return result;
}
