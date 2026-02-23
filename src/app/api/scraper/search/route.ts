import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { searchListings, calculateVacancyCost, classifyOwnerType } from '@/lib/rentcast';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      city,
      state,
      minDaysOnMarket = 30,
      propertyType,
      maxResults = 50,
    } = body;

    if (!city || !state) {
      return NextResponse.json({ error: 'city and state are required' }, { status: 400 });
    }

    // Search RentCast for stale listings
    const listings = await searchListings({
      city,
      state,
      minDaysOnMarket,
      propertyType,
      limit: maxResults,
    });

    // Save to database (dedup on rentcast_id)
    let saved = 0;
    let skipped = 0;
    const results = [];

    for (const l of listings) {
      const dom = l.daysOnMarket || 0;
      const vacancyCost = calculateVacancyCost(l.price || 0, dom);

      // Check for existing
      const existing = await query('SELECT id FROM listings WHERE rentcast_id = $1', [l.id]);
      if (existing.rows.length > 0) {
        // Update DOM and vacancy cost
        await query(
          `UPDATE listings SET days_on_market = $1, estimated_vacancy_cost = $2, updated_at = NOW() WHERE rentcast_id = $3`,
          [dom, vacancyCost, l.id]
        );
        skipped++;
        results.push({ ...existing.rows[0], address: l.formattedAddress, updated: true });
        continue;
      }

      const insertResult = await query(
        `INSERT INTO listings (
          rentcast_id, address, city, state, zip_code, property_type,
          bedrooms, bathrooms, sqft, listed_price, days_on_market,
          listed_date, estimated_vacancy_cost, source
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        RETURNING id`,
        [
          l.id,
          l.formattedAddress || l.addressLine1,
          l.city || city,
          l.state || state,
          l.zipCode,
          l.propertyType,
          l.bedrooms,
          l.bathrooms,
          l.squareFootage,
          l.price,
          dom,
          l.listedDate,
          vacancyCost,
          'rentcast',
        ]
      );

      saved++;
      results.push({
        id: insertResult.rows[0].id,
        address: l.formattedAddress,
        price: l.price,
        bedrooms: l.bedrooms,
        bathrooms: l.bathrooms,
        daysOnMarket: dom,
        vacancyCost,
        propertyType: l.propertyType,
        zipCode: l.zipCode,
      });
    }

    // Also fetch current DB listings for this city
    const dbListings = await query(
      `SELECT * FROM listings WHERE LOWER(city) = LOWER($1) AND LOWER(state) = LOWER($2) ORDER BY days_on_market DESC`,
      [city, state]
    );

    return NextResponse.json({
      searched: { city, state, minDaysOnMarket, propertyType },
      apiResults: listings.length,
      saved,
      skipped,
      listings: dbListings.rows,
    });
  } catch (error: any) {
    console.error('Scraper search error:', error);
    return NextResponse.json({ error: error.message || 'Search failed' }, { status: 500 });
  }
}

// GET: Fetch saved listings with optional filters
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const city = searchParams.get('city');
    const state = searchParams.get('state');
    const minDOM = searchParams.get('minDays') || '0';
    const ownerType = searchParams.get('ownerType');
    const imported = searchParams.get('imported');

    let sql = 'SELECT * FROM listings WHERE 1=1';
    const params: any[] = [];
    let idx = 1;

    if (city) {
      sql += ` AND LOWER(city) = LOWER($${idx++})`;
      params.push(city);
    }
    if (state) {
      sql += ` AND LOWER(state) = LOWER($${idx++})`;
      params.push(state);
    }
    if (parseInt(minDOM) > 0) {
      sql += ` AND days_on_market >= $${idx++}`;
      params.push(parseInt(minDOM));
    }
    if (ownerType) {
      sql += ` AND owner_type = $${idx++}`;
      params.push(ownerType);
    }
    if (imported === '0' || imported === '1') {
      sql += ` AND imported_to_contacts = $${idx++}`;
      params.push(parseInt(imported));
    }

    sql += ' ORDER BY days_on_market DESC';

    const result = await query(sql, params);

    // Summary stats
    const stats = await query(`
      SELECT
        COUNT(*) as total,
        AVG(days_on_market) as avg_dom,
        SUM(estimated_vacancy_cost) as total_vacancy_cost,
        COUNT(CASE WHEN owner_type = 'individual' THEN 1 END) as individual_count,
        COUNT(CASE WHEN owner_type = 'corporate' THEN 1 END) as corporate_count,
        COUNT(CASE WHEN imported_to_contacts = 1 THEN 1 END) as imported_count
      FROM listings
      ${city ? "WHERE LOWER(city) = LOWER($1)" : ''}
      ${city && state ? "AND LOWER(state) = LOWER($2)" : state ? "WHERE LOWER(state) = LOWER($1)" : ''}
    `, city && state ? [city, state] : city ? [city] : state ? [state] : []);

    return NextResponse.json({
      listings: result.rows,
      stats: stats.rows[0] || {},
    });
  } catch (error: any) {
    console.error('Scraper fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
