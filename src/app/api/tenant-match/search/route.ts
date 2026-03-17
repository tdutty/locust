import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { searchListings, getPropertyDetails, classifyOwnerType, calculateVacancyCost } from '@/lib/rentcast';
import { searchRentals as searchScrapeak } from '@/lib/scrapeak';
import { searchZillowRentals } from '@/lib/zillow-search';
import { scrapeZillowListing, scrapeZillowContact } from '@/lib/zillow-scraper';
import { enrichProperty } from '@/lib/propertyreach';
import { getStreetViewUrl, getStreetViewUrlByAddress } from '@/lib/street-view';
import { scoreListingQuality, filterByQuality, extractListingAmenities } from '@/lib/listing-quality';

const SWEETLEASE_API_URL = process.env.SWEETLEASE_API_URL;
const SWEETLEASE_WEBHOOK_SECRET = process.env.SWEETLEASE_WEBHOOK_SECRET;
const APOLLO_API_KEY = process.env.APOLLO_API_KEY || '';

const STATE_ABBR: Record<string, string> = {
  alabama:'AL',alaska:'AK',arizona:'AZ',arkansas:'AR',california:'CA',colorado:'CO',connecticut:'CT',
  delaware:'DE',florida:'FL',georgia:'GA',hawaii:'HI',idaho:'ID',illinois:'IL',indiana:'IN',iowa:'IA',
  kansas:'KS',kentucky:'KY',louisiana:'LA',maine:'ME',maryland:'MD',massachusetts:'MA',michigan:'MI',
  minnesota:'MN',mississippi:'MS',missouri:'MO',montana:'MT',nebraska:'NE',nevada:'NV',
  'new hampshire':'NH','new jersey':'NJ','new mexico':'NM','new york':'NY','north carolina':'NC',
  'north dakota':'ND',ohio:'OH',oklahoma:'OK',oregon:'OR',pennsylvania:'PA','rhode island':'RI',
  'south carolina':'SC','south dakota':'SD',tennessee:'TN',texas:'TX',utah:'UT',vermont:'VT',
  virginia:'VA',washington:'WA','west virginia':'WV',wisconsin:'WI',wyoming:'WY',
  'district of columbia':'DC',
};

function normalizeState(state: string): string {
  const trimmed = state.trim();
  if (trimmed.length === 2) return trimmed.toUpperCase();
  return STATE_ABBR[trimmed.toLowerCase()] || trimmed;
}

export async function POST(req: NextRequest) {
  try {
    // Validate webhook secret
    const webhookSecret = process.env.SWEETLEASE_WEBHOOK_SECRET;
    const providedSecret = req.headers.get('x-webhook-secret');

    if (!webhookSecret || providedSecret !== webhookSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { matchRequestId, email, name, city, budgetMin, budgetMax, bedrooms, moveInDate, amenities } = body;
    const tenantAmenities: string[] = amenities || [];
    const state = normalizeState(body.state || '');

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

    // Check if city has been scanned recently (within 7 days)
    console.log(`[tenant-match] Searching for ${city}, ${state} | ${bedrooms}BR | max $${budgetMax}`);

    const maxPrice = budgetMax ? Math.round(budgetMax * 1.15) : 99999;
    const minPrice = budgetMin || 0;

    let zillowListings: Array<any> = [];

    const scanCheck = await query(
      `SELECT id, completed_at FROM city_scans
       WHERE city = $1 AND state = $2 AND status = 'completed'
         AND completed_at > NOW() - INTERVAL '7 days'`,
      [city, state]
    ).catch(() => ({ rows: [] }));

    if (scanCheck.rows.length > 0) {
      // City already scanned — query DB instead of hitting APIs
      console.log(`[tenant-match] City ${city}, ${state} already scanned (${scanCheck.rows[0].completed_at}). Querying DB...`);

      const dbListings = await query(
        `SELECT rentcast_id as zpid, address, city, state, zip_code, listed_price, bedrooms, bathrooms, sqft,
                latitude, longitude, property_type, zillow_url, zillow_photos, days_on_market,
                owner_name, owner_email, owner_phone, owner_type, quality_score
         FROM listings
         WHERE city = $1 AND state = $2
           AND listed_price >= $3 AND listed_price <= $4
           AND bedrooms >= $5
           AND source = 'zillow-scan'
         ORDER BY quality_score DESC NULLS LAST, listed_price ASC
         LIMIT 40`,
        [city, state, minPrice, maxPrice, bedrooms]
      );

      if (dbListings.rows.length > 0) {
        console.log(`[tenant-match] Found ${dbListings.rows.length} listings in DB`);

        // Also pull portfolio landlord data for these listings
        const landlords = await query(
          `SELECT building_name, owner_name, owner_email, owner_phone, portfolio_size, listing_phone
           FROM portfolio_landlords
           WHERE city = $1 AND state = $2`,
          [city, state]
        ).catch(() => ({ rows: [] }));

        const landlordMap = new Map<string, any>();
        for (const l of landlords.rows) {
          if (l.building_name) landlordMap.set(l.building_name.toLowerCase(), l);
        }

        zillowListings = dbListings.rows.map((r: any) => {
          // Try to match with portfolio landlord data
          const buildingName = r.address?.match(/^([^,]+),/)?.[0]?.replace(',', '').trim();
          const landlord = buildingName ? landlordMap.get(buildingName.toLowerCase()) : null;

          return {
            zpid: r.zpid,
            address: r.address,
            streetAddress: r.address?.split(',')[0] || '',
            city: r.city,
            state: r.state,
            zipCode: r.zip_code,
            price: r.listed_price,
            bedrooms: r.bedrooms,
            bathrooms: r.bathrooms,
            sqft: r.sqft,
            latitude: r.latitude,
            longitude: r.longitude,
            propertyType: r.property_type,
            listingUrl: r.zillow_url || '',
            photos: r.zillow_photos || [],
            daysOnZillow: r.days_on_market || 0,
            listingAgent: null,
            listingPhone: landlord?.listing_phone || null,
            brokerName: null,
            buildingName: null,
            flexRecs: [] as Array<{ displayString: string; contentType: string }>,
            zovInsight: null as { displayString: string; amenityType: string } | null,
            // Pre-enriched from DB
            source: 'db' as const,
            dbOwnerName: r.owner_name || landlord?.owner_name || null,
            dbOwnerEmail: r.owner_email || landlord?.owner_email || null,
            dbOwnerPhone: r.owner_phone || landlord?.owner_phone || null,
            dbOwnerType: r.owner_type || null,
            dbPortfolioSize: landlord?.portfolio_size || 0,
          };
        });
      }
    }

    // If DB didn't have enough results, fall back to live Scrapeak search
    if (zillowListings.length < 10) {
      console.log(`[tenant-match] DB had ${zillowListings.length} results, querying Scrapeak...`);

      const scrapeakResults = await searchScrapeak({
        city,
        state,
        bedrooms: bedrooms || undefined,
        maxPrice: maxPrice,
        minPrice: minPrice,
      });

      const scrapeakListings = scrapeakResults.map(s => ({
        zpid: s.zpid,
        address: s.address,
        streetAddress: s.streetAddress,
        city: s.city,
        state: s.state,
        zipCode: s.zipCode,
        price: s.price,
        bedrooms: s.bedrooms,
        bathrooms: s.bathrooms,
        sqft: s.sqft,
        latitude: s.latitude,
        longitude: s.longitude,
        propertyType: s.propertyType,
        listingUrl: s.listingUrl,
        photos: s.photos,
        daysOnZillow: s.daysOnZillow,
        listingAgent: s.phone ? `Phone: ${s.phone}` : null,
        listingPhone: s.phone,
        brokerName: s.buildingName,
        buildingName: s.buildingName,
        flexRecs: s.flexRecs,
        zovInsight: s.zovInsight,
      }));

      // Fallback to direct Zillow scrape if Scrapeak also returned 0
      if (scrapeakListings.length === 0) {
        console.log(`[tenant-match] Scrapeak returned 0, trying Zillow scrape`);
        const directResults = await searchZillowRentals({
          city,
          state,
          bedrooms: bedrooms || undefined,
          maxPrice,
          minPrice,
          limit: 40,
        });
        zillowListings = directResults.map(d => ({
          ...d,
          listingPhone: null as string | null,
          flexRecs: [] as Array<{ displayString: string; contentType: string }>,
          zovInsight: null as { displayString: string; amenityType: string } | null,
        }));
      } else {
        // Deduplicate against DB results
        const existingZpids = new Set(zillowListings.map(l => l.zpid));
        const newListings = scrapeakListings.filter(l => !existingZpids.has(l.zpid));
        zillowListings = [...zillowListings, ...newListings];
      }
    }

    // Convert Zillow listings to common format
    let listings: Array<{
      id: string;
      formattedAddress: string;
      addressLine1: string;
      city: string;
      state: string;
      zipCode: string;
      price: number;
      bedrooms: number;
      bathrooms: number;
      squareFootage: number | null;
      latitude: number;
      longitude: number;
      propertyType: string | null;
      daysOnMarket: number;
      listingType: string;
      listedDate: string;
      lastSeenDate: string;
      status: string;
      // Zillow extras
      zillowUrl?: string;
      zillowPhotos?: string[];
      listingAgent?: string | null;
      brokerName?: string | null;
      source: 'zillow' | 'rentcast';
    }>;

    if (zillowListings.length > 0) {
      console.log(`[tenant-match] Zillow returned ${zillowListings.length} listings`);
      listings = zillowListings.map(z => ({
        id: `zillow-${z.zpid}`,
        formattedAddress: z.address || `${z.streetAddress}, ${z.city}, ${z.state} ${z.zipCode}`,
        addressLine1: z.streetAddress,
        city: z.city || city,
        state: z.state || state,
        zipCode: z.zipCode,
        price: z.price,
        bedrooms: z.bedrooms,
        bathrooms: z.bathrooms,
        squareFootage: z.sqft,
        latitude: z.latitude,
        longitude: z.longitude,
        propertyType: z.propertyType,
        daysOnMarket: z.daysOnZillow,
        listingType: 'Rental',
        listedDate: '',
        lastSeenDate: new Date().toISOString(),
        status: 'Active',
        zillowUrl: z.listingUrl,
        zillowPhotos: z.photos,
        listingAgent: z.listingAgent,
        brokerName: z.brokerName,
        source: 'zillow' as const,
      }));
    } else {
      // Fallback to RentCast
      console.log(`[tenant-match] Zillow returned 0 listings, falling back to RentCast`);
      try {
        const rentcastResults = await searchListings({
          city,
          state,
          bedrooms: bedrooms || undefined,
          maxPrice: budgetMax ? Math.round(budgetMax * 1.15) : undefined,
          minPrice: budgetMin || undefined,
          minDaysOnMarket: 0,
          limit: 50,
        });
        listings = rentcastResults.map(l => ({ ...l, source: 'rentcast' as const }));
      } catch (err) {
        console.error('RentCast fallback also failed:', err);
        await query(
          `UPDATE tenant_match_jobs SET status = 'failed', updated_at = NOW() WHERE id = $1`,
          [jobId]
        );
        await callbackToSweetLease(matchRequestId, 'searching', 0);
        return NextResponse.json({ jobId, error: 'Listing search failed' }, { status: 500 });
      }
    }

    // Pre-score all listings BEFORE enrichment to pick the best candidates
    // This uses data we already have from Scrapeak (phone, photos, building name, amenities)
    // No API calls — just ranking what we've got
    const prescoredListings = listings
      .filter(l => l.price > 0)
      .map(l => {
        let prescore = 0;

        // Has phone from Zillow CTA (10pts) — means we can call immediately
        if ((l as any).listingPhone) prescore += 10;

        // Photos available (5pts)
        if ((l as any).zillowPhotos?.length >= 3 || (l as any).photos?.length >= 3) prescore += 5;

        // Price within budget (15pts scaled)
        if (l.price > 0 && budgetMax > 0) {
          const ratio = l.price / budgetMax;
          if (ratio <= 0.85) prescore += 15;       // well under budget
          else if (ratio <= 1.0) prescore += 12;    // within budget
          else if (ratio <= 1.1) prescore += 8;     // slightly over
          else if (ratio <= 1.15) prescore += 3;    // at tolerance edge
        }

        // Bedroom match (10pts)
        if (l.bedrooms > 0 && l.bedrooms === bedrooms) prescore += 10;
        else if (l.bedrooms > 0 && l.bedrooms === bedrooms + 1) prescore += 5;

        // Amenity hints from Scrapeak (10pts)
        if (tenantAmenities.length > 0) {
          const flexRecs = ((l as any).flexRecs || []).map((r: any) => r.displayString?.toLowerCase() || '');
          const zovText = (l as any).zovInsight?.displayString?.toLowerCase() || '';
          const buildingText = ((l as any).buildingName || '').toLowerCase();
          const allText = [...flexRecs, zovText, buildingText].join(' ');

          let matched = 0;
          for (const amenity of tenantAmenities) {
            const keywords: Record<string, string[]> = {
              'Parking': ['parking', 'garage'], 'Gym': ['gym', 'fitness'], 'Pool': ['pool', 'swimming'],
              'Pets OK': ['pet', 'dog', 'cat'], 'A/C': ['air', 'a/c', 'hvac'], 'Balcony': ['balcony', 'patio'],
              'In-Unit Laundry': ['laundry', 'washer'], 'Dishwasher': ['dishwasher'],
              'Doorman': ['doorman', 'concierge'], 'Rooftop': ['rooftop'], 'EV Charging': ['ev', 'charging'],
              'Furnished': ['furnished'], 'Storage': ['storage'], 'Walk-in Closet': ['walk-in', 'closet'],
              'Hardwood Floors': ['hardwood'], 'Washer/Dryer Hookup': ['hookup', 'washer'],
            };
            const kws = keywords[amenity] || [amenity.toLowerCase()];
            if (kws.some(kw => allText.includes(kw))) matched++;
          }
          prescore += Math.round((matched / tenantAmenities.length) * 10);
        }

        // Days on market — staler = more negotiation leverage (5pts)
        const dom = l.daysOnMarket || 0;
        if (dom >= 30) prescore += 5;
        else if (dom >= 14) prescore += 3;

        // Is apartment complex (3pts) — usually has more units = portfolio potential
        if ((l as any).buildingName) prescore += 3;

        return { listing: l, prescore };
      })
      .sort((a, b) => b.prescore - a.prescore);

    console.log(`[tenant-match] Pre-scored ${prescoredListings.length} listings. Top score: ${prescoredListings[0]?.prescore || 0}, Bottom: ${prescoredListings[prescoredListings.length - 1]?.prescore || 0}`);

    // Take top 20 for enrichment (PropertyReach + Apollo — expensive calls)
    const topCandidates = prescoredListings.slice(0, 20).map(p => p.listing);

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
      ownerPhone: string | null;
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
      // Check if this listing came from the DB with pre-enriched owner data
      let ownerName: string | null = (listing as any).dbOwnerName || null;
      let ownerType: string | null = (listing as any).dbOwnerType || null;
      let ownerPhone: string | null = (listing as any).dbOwnerPhone || null;
      let ownerEmail: string | null = (listing as any).dbOwnerEmail || null;
      const dbPortfolioSize: number = (listing as any).dbPortfolioSize || 0;

      // If already enriched from city scan, skip expensive API calls
      if (ownerName && (ownerEmail || ownerPhone)) {
        console.log(`[tenant-match] Skipping enrichment for ${listing.formattedAddress} — already enriched from DB`);
      } else {
      try {
        const existingListing = await query('SELECT owner_name, owner_email, owner_phone FROM listings WHERE id = $1', [listingDbId]);
        const row = existingListing.rows[0];
        if (!ownerName) ownerName = row.owner_name;
        if (!ownerEmail) ownerEmail = row.owner_email;
        if (!ownerPhone) ownerPhone = row.owner_phone;

        if (!ownerName || !ownerEmail) {
          // Step 0: PropertyReach skip trace + portfolio detection (primary source)
          const zipCode = listing.zipCode || '';
          const streetAddr = listing.addressLine1 || listing.formattedAddress.split(',')[0];
          try {
            const prResult = await enrichProperty(streetAddr, listing.city, listing.state, zipCode);
            if (prResult.ownerName) ownerName = prResult.ownerName;
            if (prResult.ownerEmail) ownerEmail = prResult.ownerEmail;
            if (prResult.ownerPhone) ownerPhone = prResult.ownerPhone;
            if (prResult.ownerType !== 'unknown') ownerType = prResult.ownerType === 'corporate' ? 'corporate' : 'individual';

            // Store portfolio size + estimated value in listing metadata
            if (prResult.portfolioSize > 0 || prResult.estimatedValue) {
              await query(
                `UPDATE listings SET
                  portfolio_size = COALESCE($1, portfolio_size),
                  estimated_value = COALESCE($2, estimated_value),
                  updated_at = NOW()
                WHERE id = $3`,
                [prResult.portfolioSize || null, prResult.estimatedValue || null, listingDbId]
              ).catch(() => {
                // Columns may not exist yet — non-blocking
              });
            }
          } catch (prErr) {
            console.warn(`PropertyReach enrichment failed for ${listing.formattedAddress}:`, prErr);
          }

          // Step 1: Fallback to RentCast property details if PropertyReach didn't find owner
          if (!ownerName) {
            const property = await getPropertyDetails(listing.formattedAddress);
            if (property?.ownerName) {
              ownerName = property.ownerName;
              ownerType = classifyOwnerType(ownerName);
            }
          }

          // Step 2: Fallback to Apollo for contact info if still missing email
          if (ownerName && !ownerEmail && APOLLO_API_KEY) {
            try {
              const isCorporate = classifyOwnerType(ownerName) === 'corporate';

              if (isCorporate) {
                // Search for the company to get domain, then find contacts
                const orgRes = await fetch('https://api.apollo.io/api/v1/mixed_companies/search', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'X-Api-Key': APOLLO_API_KEY },
                  body: JSON.stringify({
                    page: 1,
                    per_page: 1,
                    q_organization_name: ownerName,
                    organization_locations: [`${city}, ${state}`],
                    q_organization_keyword_tags: ['property', 'real estate', 'landlord', 'rental', 'management'],
                  }),
                });

                if (orgRes.ok) {
                  const orgData = await orgRes.json();
                  const orgs = orgData.organizations || orgData.accounts || [];
                  if (orgs.length > 0) {
                    const org = orgs[0];
                    // Use company's primary domain to construct generic email
                    const domain = org.primary_domain || org.website_url?.replace(/https?:\/\/(www\.)?/, '').split('/')[0];
                    if (domain) {
                      ownerEmail = `info@${domain}`;
                    }
                    ownerPhone = org.phone || ownerPhone;

                    // Also search for a person at this company (property manager, leasing agent)
                    const peopleRes = await fetch('https://api.apollo.io/api/v1/mixed_people/search', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'X-Api-Key': APOLLO_API_KEY },
                      body: JSON.stringify({
                        page: 1,
                        per_page: 1,
                        q_organization_domains: domain ? [domain] : undefined,
                        person_titles: ['property manager', 'leasing', 'leasing agent', 'leasing manager', 'operations'],
                      }),
                    });

                    if (peopleRes.ok) {
                      const peopleData = await peopleRes.json();
                      const people = peopleData.people || [];
                      if (people.length > 0 && people[0].email) {
                        ownerEmail = people[0].email;
                        ownerPhone = people[0].phone_numbers?.[0]?.raw_number || ownerPhone;
                        ownerName = `${people[0].first_name} ${people[0].last_name} (${ownerName})`;
                      }
                    }
                  }
                }
              } else {
                // Individual owner — search by name + location
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
              }
            } catch {
              // Apollo enrichment failed, continue
            }
          }

          if (!ownerType && ownerName) ownerType = classifyOwnerType(ownerName);

          // Step 3: Zillow contact scraping fallback — get listing agent/property manager
          if (!ownerName || !ownerPhone) {
            const zillowUrlRow = await query('SELECT zillow_url FROM listings WHERE id = $1', [listingDbId]);
            const zUrl = zillowUrlRow.rows[0]?.zillow_url;
            if (zUrl) {
              try {
                const contact = await scrapeZillowContact(zUrl);
                if (!ownerName && (contact.agentName || contact.propertyManager)) {
                  ownerName = contact.propertyManager || contact.agentName;
                  ownerType = contact.propertyManager ? 'corporate' : 'individual';
                }
                if (!ownerPhone && contact.agentPhone) {
                  ownerPhone = contact.agentPhone;
                }
                if (!ownerName && contact.brokerName) {
                  ownerName = contact.brokerName;
                  ownerType = 'corporate';
                }
              } catch {
                // Zillow contact scrape failed, continue
              }
            }
          }

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
      } // end else (not pre-enriched)

      enrichedCandidates.push({
        listingDbId,
        rentcastListing: listing,
        ownerName,
        ownerEmail,
        ownerPhone,
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
      ownerPhone: string | null;
      ownerType: string | null;
      zillowPhotos: string[];
      zillowUrl: string | null;
      streetViewUrl: string | null;
      qualityScore: number;
    }> = [];

    for (const candidate of enrichedCandidates) {
      const { rentcastListing: l } = candidate;

      // Use existing Zillow data if listing came from Zillow search, otherwise scrape
      let zillow: { photos: string[]; zillowUrl: string | null };
      if (l.source === 'zillow' && l.zillowPhotos && l.zillowPhotos.length > 0) {
        zillow = { photos: l.zillowPhotos, zillowUrl: l.zillowUrl || null };
      } else {
        zillow = await scrapeZillowListing(l.formattedAddress, l.city, l.state, l.zipCode);
      }

      // Construct Street View URL
      let streetViewUrl: string | null = null;
      if (l.latitude && l.longitude) {
        streetViewUrl = getStreetViewUrl(l.latitude, l.longitude);
      } else {
        streetViewUrl = getStreetViewUrlByAddress(l.formattedAddress, l.city, l.state, l.zipCode);
      }

      // Extract amenity hints from Zillow data
      const listingAmenities = extractListingAmenities({
        flexRecs: (l as any).flexRecs,
        zovInsight: (l as any).zovInsight,
        buildingName: (l as any).brokerName || (l as any).buildingName,
      });

      // Compute quality + relevance score
      const { score } = scoreListingQuality({
        ownerEmail: candidate.ownerEmail,
        ownerPhone: candidate.ownerPhone,
        ownerType: candidate.ownerType,
        portfolioSize: (candidate as any).portfolioSize || 0,
        listingPhone: (l as any).listingPhone || null,
        zillowPhotos: zillow.photos,
        sqft: l.squareFootage || null,
        bathrooms: l.bathrooms || null,
        zip: l.zipCode || null,
        daysOnMarket: l.daysOnMarket || null,
        latitude: l.latitude || null,
        longitude: l.longitude || null,
        price: l.price,
        bedrooms: l.bedrooms,
        tenantBudgetMax: budgetMax,
        tenantBedrooms: bedrooms,
        tenantAmenities,
        listingAmenities,
        buildingName: (l as any).brokerName || (l as any).buildingName || null,
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
      ownerPhone: l.ownerPhone,
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
