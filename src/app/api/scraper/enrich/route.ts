import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getPropertyDetails, classifyOwnerType } from '@/lib/rentcast';

const APOLLO_API_KEY = process.env.APOLLO_API_KEY || '';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { listingId, listingIds } = body;

    const ids: number[] = listingIds || (listingId ? [listingId] : []);
    if (ids.length === 0) {
      return NextResponse.json({ error: 'listingId or listingIds required' }, { status: 400 });
    }

    const results = [];

    for (const id of ids) {
      const listing = await query('SELECT * FROM listings WHERE id = $1', [id]);
      if (listing.rows.length === 0) {
        results.push({ id, error: 'not found' });
        continue;
      }

      const row = listing.rows[0];
      let ownerName = row.owner_name;
      let ownerType = row.owner_type;
      let ownerPhone = row.owner_phone;
      let ownerEmail = row.owner_email;

      // Step 1: Try RentCast property lookup for owner info
      if (!ownerName) {
        const property = await getPropertyDetails(row.address);
        if (property) {
          ownerName = property.ownerName || null;
          ownerType = classifyOwnerType(ownerName);
        }
      }

      // Step 2: If we have owner name but no email, try Apollo
      if (ownerName && !ownerEmail && ownerType === 'individual' && APOLLO_API_KEY) {
        try {
          const apolloRes = await fetch('https://api.apollo.io/api/v1/mixed_people/search', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Api-Key': APOLLO_API_KEY,
            },
            body: JSON.stringify({
              page: 1,
              per_page: 3,
              q_keywords: ownerName,
              person_locations: [`${row.city}, ${row.state}`],
              q_organization_keyword_tags: ['property', 'real estate', 'landlord', 'rental'],
            }),
          });

          if (apolloRes.ok) {
            const apolloData = await apolloRes.json();
            const people = apolloData.people || [];
            if (people.length > 0) {
              const match = people[0];
              ownerEmail = match.email || ownerEmail;
              ownerPhone = match.phone_numbers?.[0]?.raw_number || ownerPhone;
            }
          }
        } catch (e) {
          // Apollo enrichment failed, continue without
        }
      }

      // Classify owner type if we have a name now
      if (ownerName && !ownerType) {
        ownerType = classifyOwnerType(ownerName);
      }

      // Update listing
      await query(
        `UPDATE listings SET
          owner_name = COALESCE($1, owner_name),
          owner_type = COALESCE($2, owner_type),
          owner_phone = COALESCE($3, owner_phone),
          owner_email = COALESCE($4, owner_email),
          updated_at = NOW()
        WHERE id = $5`,
        [ownerName, ownerType, ownerPhone, ownerEmail, id]
      );

      results.push({
        id,
        address: row.address,
        ownerName,
        ownerType,
        ownerPhone,
        ownerEmail,
        enriched: true,
      });
    }

    return NextResponse.json({ results, enriched: results.filter(r => r.enriched).length });
  } catch (error: any) {
    console.error('Scraper enrich error:', error);
    return NextResponse.json({ error: error.message || 'Enrichment failed' }, { status: 500 });
  }
}
