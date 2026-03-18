/**
 * Listing Enricher — pulls full property details from Scrapeak /property endpoint.
 * Gets: all photos, description, accurate beds/baths/sqft, amenities, agent info.
 * Runs in background batches, 10 credits per listing.
 */

import { query } from '@/lib/db';

const SCRAPEAK_API_KEY = process.env.SCRAPEAK_API_KEY || '';

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms + Math.random() * 500));
}

interface EnrichResult {
  processed: number;
  enriched: number;
  failed: number;
  skipped: number;
  creditsUsed: number;
}

/**
 * Enrich a batch of listings with full Scrapeak property details.
 */
export async function enrichListingBatch(batchSize: number = 5): Promise<EnrichResult> {
  // Ensure columns exist
  await query(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS description TEXT`).catch(() => {});
  await query(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS amenities TEXT[]`).catch(() => {});
  await query(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS year_built INT`).catch(() => {});
  await query(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS home_type TEXT`).catch(() => {});
  await query(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS heating TEXT[]`).catch(() => {});
  await query(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS cooling TEXT[]`).catch(() => {});
  await query(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS laundry TEXT[]`).catch(() => {});
  await query(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS parking TEXT`).catch(() => {});
  await query(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS agent_name TEXT`).catch(() => {});
  await query(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS agent_phone TEXT`).catch(() => {});
  await query(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS broker_name TEXT`).catch(() => {});
  await query(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS hi_res_image TEXT`).catch(() => {});
  await query(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ`).catch(() => {});
  await query(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS zpid TEXT`).catch(() => {});

  // Ensure enrichment log table exists
  await query(`
    CREATE TABLE IF NOT EXISTS listing_enrichment_log (
      id SERIAL PRIMARY KEY,
      listing_id INT,
      zpid TEXT,
      status TEXT NOT NULL,
      photos_found INT,
      error TEXT,
      credits_used INT,
      duration_ms INT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {});

  // Find listings not yet enriched — prioritize by quality score (best listings first)
  const listings = await query(
    `SELECT id, rentcast_id, address, city, state, zip_code, zillow_url
     FROM listings
     WHERE enriched_at IS NULL
       AND source = 'zillow-scan'
       AND zillow_photos IS NOT NULL
     ORDER BY quality_score DESC NULLS LAST
     LIMIT $1`,
    [batchSize]
  );

  let enriched = 0;
  let failed = 0;
  let skipped = 0;
  let creditsUsed = 0;

  for (const listing of listings.rows) {
    const startTime = Date.now();

    try {
      // Step 1: Get zpid from address
      const street = listing.address?.split(',')[0]?.trim();
      const city = listing.city;
      const state = listing.state;
      const zip = listing.zip_code;

      if (!street || !city || !state) {
        skipped++;
        await query(`UPDATE listings SET enriched_at = NOW() WHERE id = $1`, [listing.id]);
        continue;
      }

      const zpidRes = await fetch(
        `https://app.scrapeak.com/v1/scrapers/zillow/zpidByAddress?api_key=${SCRAPEAK_API_KEY}&street=${encodeURIComponent(street)}&city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}${zip ? `&zipcode=${zip}` : ''}`,
        { signal: AbortSignal.timeout(30000) }
      );
      const zpidData = await zpidRes.json();
      creditsUsed += 10;

      if (!zpidData.is_success || !zpidData.data?.[0]?.zpid) {
        // Log and mark as enriched (so we don't retry)
        await query(
          `INSERT INTO listing_enrichment_log (listing_id, status, error, credits_used, duration_ms) VALUES ($1, 'no_zpid', $2, 10, $3)`,
          [listing.id, 'Address not found on Zillow', Date.now() - startTime]
        );
        await query(`UPDATE listings SET enriched_at = NOW() WHERE id = $1`, [listing.id]);
        skipped++;
        await delay(300);
        continue;
      }

      const zpid = zpidData.data[0].zpid;

      // Step 2: Get full property details
      await delay(300);

      const propRes = await fetch(
        `https://app.scrapeak.com/v1/scrapers/zillow/property?api_key=${SCRAPEAK_API_KEY}&zpid=${zpid}`,
        { signal: AbortSignal.timeout(30000) }
      );
      const propData = await propRes.json();
      creditsUsed += 10;

      if (!propData.is_success || !propData.data) {
        await query(
          `INSERT INTO listing_enrichment_log (listing_id, zpid, status, error, credits_used, duration_ms) VALUES ($1, $2, 'failed', $3, 20, $4)`,
          [listing.id, zpid, propData.message || 'No data returned', Date.now() - startTime]
        );
        await query(`UPDATE listings SET enriched_at = NOW(), zpid = $2 WHERE id = $1`, [listing.id, zpid]);
        failed++;
        await delay(2000);
        continue;
      }

      const d = propData.data;

      // Extract all photos (highest resolution)
      const photos: string[] = [];
      const responsivePhotos = d.responsivePhotos || d.photos || [];
      for (const p of responsivePhotos) {
        // Get largest JPEG
        const jpegs = p.mixedSources?.jpeg || [];
        const largest = jpegs.length > 0 ? jpegs[jpegs.length - 1] : null;
        const url = largest?.url || p.url;
        if (url) photos.push(url);
      }

      // Extract amenities from description + facts
      const amenities: string[] = [];
      const desc = (d.description || '').toLowerCase();
      const facts = d.resoFacts || {};

      // Parse amenities from description keywords
      const amenityKeywords: Record<string, string> = {
        'pool': 'Pool', 'swimming': 'Pool', 'gym': 'Gym', 'fitness': 'Gym',
        'parking': 'Parking', 'garage': 'Garage', 'laundry': 'Laundry',
        'washer': 'Washer/Dryer', 'dishwasher': 'Dishwasher', 'balcony': 'Balcony',
        'patio': 'Patio', 'fireplace': 'Fireplace', 'hardwood': 'Hardwood Floors',
        'stainless': 'Stainless Appliances', 'granite': 'Granite Counters',
        'walk-in closet': 'Walk-in Closet', 'vaulted ceiling': 'Vaulted Ceilings',
        'clubhouse': 'Clubhouse', 'concierge': 'Concierge', 'doorman': 'Doorman',
        'rooftop': 'Rooftop', 'ev charging': 'EV Charging', 'furnished': 'Furnished',
        'pet': 'Pet Friendly', 'dog': 'Pet Friendly', 'cat': 'Pet Friendly',
        'storage': 'Storage', 'elevator': 'Elevator', 'security': 'Security',
      };

      for (const [keyword, amenity] of Object.entries(amenityKeywords)) {
        if (desc.includes(keyword) && !amenities.includes(amenity)) {
          amenities.push(amenity);
        }
      }

      // Add structured facts
      if (facts.cooling?.length) amenities.push('A/C');
      if (facts.heating?.length) amenities.push('Heating');
      if (facts.laundryFeatures?.length) amenities.push('Laundry');
      if (facts.parking) amenities.push('Parking');

      // Update listing with full data
      await query(
        `UPDATE listings SET
          zillow_photos = $1,
          bathrooms = COALESCE($2, bathrooms),
          sqft = COALESCE($3, sqft),
          description = $4,
          amenities = $5,
          year_built = $6,
          home_type = $7,
          heating = $8,
          cooling = $9,
          laundry = $10,
          parking = $11,
          agent_name = $12,
          agent_phone = $13,
          broker_name = $14,
          hi_res_image = $15,
          zpid = $16,
          enriched_at = NOW(),
          updated_at = NOW()
        WHERE id = $17`,
        [
          photos.length > 0 ? photos : listing.zillow_photos,
          d.bathrooms || null,
          d.livingArea || null,
          d.description || null,
          amenities.length > 0 ? amenities : null,
          d.yearBuilt || null,
          d.homeType || null,
          facts.heating || null,
          facts.cooling || null,
          facts.laundryFeatures || null,
          facts.parking ? String(facts.parking) : null,
          d.attributionInfo?.agentName || null,
          d.attributionInfo?.agentPhoneNumber || null,
          d.attributionInfo?.brokerName || null,
          d.hiResImageLink || null,
          zpid,
          listing.id,
        ]
      );

      // Log success
      await query(
        `INSERT INTO listing_enrichment_log (listing_id, zpid, status, photos_found, credits_used, duration_ms) VALUES ($1, $2, 'success', $3, 20, $4)`,
        [listing.id, zpid, photos.length, Date.now() - startTime]
      );

      enriched++;
      console.log(`[enricher] ${listing.address}: ${photos.length} photos, ${amenities.length} amenities, ${d.bathrooms || 0} baths`);

      // Delay between listings (500ms-1s)
      await delay(500 + Math.random() * 500);
    } catch (err: any) {
      failed++;
      await query(
        `INSERT INTO listing_enrichment_log (listing_id, status, error, duration_ms) VALUES ($1, 'error', $2, $3)`,
        [listing.id, err.message?.slice(0, 200), Date.now() - startTime]
      ).catch(() => {});
      await query(`UPDATE listings SET enriched_at = NOW() WHERE id = $1`, [listing.id]).catch(() => {});
      console.error(`[enricher] Failed for ${listing.address}: ${err.message}`);
    }
  }

  return { processed: listings.rows.length, enriched, failed, skipped, creditsUsed };
}

/**
 * Get enrichment progress stats.
 */
export async function getEnrichmentProgress(): Promise<{
  totalListings: number;
  enriched: number;
  pending: number;
  percentComplete: number;
  creditsUsed: number;
  enrichedLastHour: number;
  failedLastHour: number;
  avgPhotosPerListing: number;
}> {
  const counts = await query(`
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN enriched_at IS NOT NULL THEN 1 END) as enriched,
      COUNT(CASE WHEN enriched_at IS NULL AND source = 'zillow-scan' THEN 1 END) as pending
    FROM listings
  `).catch(() => ({ rows: [{ total: '0', enriched: '0', pending: '0' }] }));

  const hourStats = await query(`
    SELECT
      COUNT(CASE WHEN status = 'success' THEN 1 END) as success,
      COUNT(CASE WHEN status IN ('failed', 'error') THEN 1 END) as failed,
      SUM(CASE WHEN status = 'success' THEN credits_used ELSE 0 END) as credits,
      AVG(CASE WHEN status = 'success' THEN photos_found ELSE NULL END) as avg_photos
    FROM listing_enrichment_log
    WHERE created_at > NOW() - INTERVAL '1 hour'
  `).catch(() => ({ rows: [{ success: '0', failed: '0', credits: '0', avg_photos: '0' }] }));

  const totalCredits = await query(`
    SELECT SUM(credits_used) as total FROM listing_enrichment_log
  `).catch(() => ({ rows: [{ total: '0' }] }));

  const c = counts.rows[0];
  const h = hourStats.rows[0];
  const total = parseInt(c.total);
  const enrichedCount = parseInt(c.enriched);

  return {
    totalListings: total,
    enriched: enrichedCount,
    pending: parseInt(c.pending),
    percentComplete: total > 0 ? Math.round((enrichedCount / total) * 100) : 0,
    creditsUsed: parseInt(totalCredits.rows[0].total) || 0,
    enrichedLastHour: parseInt(h.success) || 0,
    failedLastHour: parseInt(h.failed) || 0,
    avgPhotosPerListing: Math.round(parseFloat(h.avg_photos) || 0),
  };
}
