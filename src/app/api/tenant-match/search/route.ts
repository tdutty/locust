import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { searchListings, getPropertyDetails, classifyOwnerType, calculateVacancyCost } from '@/lib/rentcast';
import { scrapeZillowListing } from '@/lib/zillow-scraper';
import { getStreetViewUrl, getStreetViewUrlByAddress } from '@/lib/street-view';
import { scoreListingQuality, filterByQuality } from '@/lib/listing-quality';

const SWEETLEASE_API_URL = process.env.SWEETLEASE_API_URL;
const SWEETLEASE_WEBHOOK_SECRET = process.env.SWEETLEASE_WEBHOOK_SECRET;
const APOLLO_API_KEY = process.env.APOLLO_API_KEY || '';

export async function POST(req: NextRequest) {
  try {
    // Validate webhook secret
    const webhookSecret = process.env.SWEETLEASE_WEBHOOK_SECRET;
    const providedSecret = req.headers.get('x-webhook-secret');

    if (!webhookSecret || providedSecret !== webhookSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { matchRequestId, email, name, city, state, budgetMin, budgetMax, bedrooms, moveInDate } = body;

    if (!matchRequestId || !city || !state || !budgetMax) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Create tenant_match_jobs row
    const jobResult = await query(
      `INSERT INTO tenant_match_jobs (sweetlease_match_request_id, tenant_email, tenant_name, city, state, budget_max, budget_min, bedrooms, move_in_date, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'searching')
       ON CONFLICT (sweetlease_match_request_id) DO UPDATE SET status = 'searching', updated_at = NOW()
       RETURNING id`,
      [matchRequestId, email, name, city, state, budgetMax, budgetMin || null, bedrooms, moveInDate || null]
    );
    const jobId = jobResult.rows[0].id;

    // Search RentCast for listings in the tenant's city/state
    let listings;
    try {
      listings = await searchListings({
        city,
        state,
        minDaysOnMarket: 7,
        limit: 50,
      });
    } catch (err) {
      console.error('RentCast search failed:', err);
      await query(
        `UPDATE tenant_match_jobs SET status = 'failed', updated_at = NOW() WHERE id = $1`,
        [jobId]
      );
      await callbackToSweetLease(matchRequestId, 'searching', 0);
      return NextResponse.json({ jobId, error: 'Listing search failed' }, { status: 500 });
    }

    // Filter by bedrooms and budget
    const filtered = listings.filter(l => {
      const matchesBedrooms = l.bedrooms >= bedrooms;
      const matchesBudget = l.price <= budgetMax * 1.1; // Allow 10% over budget
      return matchesBedrooms && matchesBudget;
    });

    // Sort by relevance: closest to budget, then by days on market (staler = more motivated landlord)
    const sorted = filtered.sort((a, b) => {
      const aDiff = Math.abs(a.price - budgetMax);
      const bDiff = Math.abs(b.price - budgetMax);
      if (aDiff !== bDiff) return aDiff - bDiff;
      return (b.daysOnMarket || 0) - (a.daysOnMarket || 0);
    });

    // Take top 20 candidates (we'll quality-filter down to 10 later)
    const topCandidates = sorted.slice(0, 20);

    if (topCandidates.length === 0) {
      await query(
        `UPDATE tenant_match_jobs SET status = 'matched', matched_listing_ids = '{}', updated_at = NOW() WHERE id = $1`,
        [jobId]
      );
      await callbackToSweetLease(matchRequestId, 'matched', 0);
      return NextResponse.json({ jobId, matchCount: 0 });
    }

    // Insert listings into Locust DB and enrich with owner info
    const enrichedCandidates: Array<{
      listingDbId: number;
      rentcastListing: typeof topCandidates[0];
      ownerName: string | null;
      ownerEmail: string | null;
      ownerType: string | null;
    }> = [];

    for (const listing of topCandidates) {
      // Upsert listing into Locust listings table (now includes lat/lng)
      const vacancyCost = calculateVacancyCost(listing.price, listing.daysOnMarket || 0);
      const upsertResult = await query(
        `INSERT INTO listings (rentcast_id, address, city, state, zip_code, property_type, bedrooms, bathrooms, sqft, listed_price, days_on_market, listed_date, estimated_vacancy_cost, latitude, longitude, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'rentcast')
         ON CONFLICT (rentcast_id) DO UPDATE SET days_on_market = $11, estimated_vacancy_cost = $13, latitude = $14, longitude = $15, updated_at = NOW()
         RETURNING id`,
        [listing.id, listing.formattedAddress, listing.city, listing.state, listing.zipCode,
         listing.propertyType, listing.bedrooms, listing.bathrooms, listing.squareFootage,
         listing.price, listing.daysOnMarket, listing.listedDate, vacancyCost,
         listing.latitude || null, listing.longitude || null]
      );
      const listingDbId = upsertResult.rows[0].id;

      // Enrich owner info from RentCast property details + Apollo
      let ownerName: string | null = null;
      let ownerType: string | null = null;
      let ownerPhone: string | null = null;
      let ownerEmail: string | null = null;

      try {
        const existingListing = await query('SELECT owner_name, owner_email FROM listings WHERE id = $1', [listingDbId]);
        const row = existingListing.rows[0];
        ownerName = row.owner_name;
        ownerEmail = row.owner_email;

        if (!ownerName || !ownerEmail) {
          // Get owner info from RentCast property details
          if (!ownerName) {
            const property = await getPropertyDetails(listing.formattedAddress);
            if (property?.ownerName) {
              ownerName = property.ownerName;
              ownerType = classifyOwnerType(ownerName);
            }
          }

          // If individual owner without email, try Apollo
          if (ownerName && !ownerEmail && classifyOwnerType(ownerName) === 'individual' && APOLLO_API_KEY) {
            try {
              const apolloRes = await fetch('https://api.apollo.io/api/v1/mixed_people/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Api-Key': APOLLO_API_KEY },
                body: JSON.stringify({
                  page: 1,
                  per_page: 3,
                  q_keywords: ownerName,
                  person_locations: [`${city}, ${state}`],
                  q_organization_keyword_tags: ['property', 'real estate', 'landlord', 'rental'],
                }),
              });

              if (apolloRes.ok) {
                const apolloData = await apolloRes.json();
                const people = apolloData.people || [];
                if (people.length > 0) {
                  ownerEmail = people[0].email || ownerEmail;
                  ownerPhone = people[0].phone_numbers?.[0]?.raw_number || ownerPhone;
                }
              }
            } catch {
              // Apollo enrichment failed, continue
            }
          }

          if (!ownerType && ownerName) ownerType = classifyOwnerType(ownerName);

          await query(
            `UPDATE listings SET
              owner_name = COALESCE($1, owner_name),
              owner_type = COALESCE($2, owner_type),
              owner_phone = COALESCE($3, owner_phone),
              owner_email = COALESCE($4, owner_email),
              updated_at = NOW()
            WHERE id = $5`,
            [ownerName, ownerType, ownerPhone, ownerEmail, listingDbId]
          );
        }
      } catch (enrichErr) {
        console.error(`Failed to enrich listing ${listingDbId}:`, enrichErr);
      }

      enrichedCandidates.push({
        listingDbId,
        rentcastListing: listing,
        ownerName,
        ownerEmail,
        ownerType: ownerType || (ownerName ? classifyOwnerType(ownerName) : null),
      });
    }

    // ----- Zillow scraping + Street View + Quality scoring -----
    console.log(`[tenant-match] Scraping Zillow for ${enrichedCandidates.length} listings...`);

    const scoredListings: Array<{
      listingDbId: number;
      rentcastListing: typeof topCandidates[0];
      ownerName: string | null;
      ownerEmail: string | null;
      ownerType: string | null;
      zillowPhotos: string[];
      zillowUrl: string | null;
      streetViewUrl: string | null;
      qualityScore: number;
    }> = [];

    for (const candidate of enrichedCandidates) {
      const { rentcastListing: l } = candidate;

      // Scrape Zillow (sequential with rate limiting built in)
      const zillow = await scrapeZillowListing(
        l.formattedAddress,
        l.city,
        l.state,
        l.zipCode
      );

      // Construct Street View URL
      let streetViewUrl: string | null = null;
      if (l.latitude && l.longitude) {
        streetViewUrl = getStreetViewUrl(l.latitude, l.longitude);
      } else {
        streetViewUrl = getStreetViewUrlByAddress(l.formattedAddress, l.city, l.state, l.zipCode);
      }

      // Compute quality score
      const { score } = scoreListingQuality({
        ownerEmail: candidate.ownerEmail,
        zillowPhotos: zillow.photos,
        ownerType: candidate.ownerType,
        sqft: l.squareFootage || null,
        bathrooms: l.bathrooms || null,
        zip: l.zipCode || null,
        daysOnMarket: l.daysOnMarket || null,
        latitude: l.latitude || null,
        longitude: l.longitude || null,
      });

      // Persist visual media + quality score to Locust DB
      await query(
        `UPDATE listings SET
          zillow_url = $1,
          zillow_photos = $2,
          street_view_url = $3,
          quality_score = $4,
          updated_at = NOW()
        WHERE id = $5`,
        [zillow.zillowUrl, zillow.photos, streetViewUrl, score, candidate.listingDbId]
      );

      scoredListings.push({
        ...candidate,
        zillowPhotos: zillow.photos,
        zillowUrl: zillow.zillowUrl,
        streetViewUrl,
        qualityScore: score,
      });
    }

    // Quality filter: score >= 40, sorted by quality desc, top 10
    const qualityFiltered = filterByQuality(scoredListings).slice(0, 10);

    console.log(`[tenant-match] Quality filter: ${scoredListings.length} → ${qualityFiltered.length} listings (threshold 40)`);

    const matchedListingIds = qualityFiltered.map(l => l.listingDbId);

    if (matchedListingIds.length === 0) {
      await query(
        `UPDATE tenant_match_jobs SET status = 'matched', matched_listing_ids = '{}', updated_at = NOW() WHERE id = $1`,
        [jobId]
      );
      await callbackToSweetLease(matchRequestId, 'matched', 0);
      return NextResponse.json({ jobId, matchCount: 0 });
    }

    // Update job with matched listings
    await query(
      `UPDATE tenant_match_jobs SET status = 'matched', matched_listing_ids = $1, updated_at = NOW() WHERE id = $2`,
      [matchedListingIds, jobId]
    );

    // Build callback payload with visual media fields
    const matchedListingData = qualityFiltered.map(l => ({
      locustListingId: l.listingDbId,
      address: l.rentcastListing.formattedAddress,
      city: l.rentcastListing.city,
      state: l.rentcastListing.state,
      zipCode: l.rentcastListing.zipCode,
      price: l.rentcastListing.price,
      bedrooms: l.rentcastListing.bedrooms,
      bathrooms: l.rentcastListing.bathrooms,
      sqft: l.rentcastListing.squareFootage,
      daysOnMarket: l.rentcastListing.daysOnMarket,
      vacancyCost: calculateVacancyCost(l.rentcastListing.price, l.rentcastListing.daysOnMarket || 0),
      ownerName: l.ownerName,
      ownerEmail: l.ownerEmail,
      ownerType: l.ownerType,
      propertyType: l.rentcastListing.propertyType,
      // New visual media fields
      latitude: l.rentcastListing.latitude || null,
      longitude: l.rentcastListing.longitude || null,
      zillowUrl: l.zillowUrl,
      zillowPhotos: l.zillowPhotos,
      streetViewUrl: l.streetViewUrl,
      qualityScore: l.qualityScore,
    }));

    await callbackToSweetLease(matchRequestId, 'matched', qualityFiltered.length, matchedListingData);

    return NextResponse.json({
      jobId,
      matchCount: qualityFiltered.length,
      enrichedCount: qualityFiltered.filter(l => l.ownerEmail).length,
      qualityFilteredFrom: scoredListings.length,
    });
  } catch (error: any) {
    console.error('Tenant match search error:', error);
    return NextResponse.json({ error: error.message || 'Search failed' }, { status: 500 });
  }
}

async function callbackToSweetLease(
  matchRequestId: string,
  status: string,
  matchCount: number,
  matchedListings?: unknown[]
) {
  if (!SWEETLEASE_API_URL || !SWEETLEASE_WEBHOOK_SECRET) return;

  try {
    await fetch(`${SWEETLEASE_API_URL}/api/tenant-match/status-update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': SWEETLEASE_WEBHOOK_SECRET,
      },
      body: JSON.stringify({ matchRequestId, status, matchCount, matchedListings }),
    });
  } catch (err) {
    console.error('Failed to callback to SweetLease:', err);
  }
}
