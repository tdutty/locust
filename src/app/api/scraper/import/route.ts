import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { listingIds } = body;

    if (!listingIds || !Array.isArray(listingIds) || listingIds.length === 0) {
      return NextResponse.json({ error: 'listingIds array required' }, { status: 400 });
    }

    const imported = [];
    const skipped = [];

    for (const id of listingIds) {
      const listing = await query('SELECT * FROM listings WHERE id = $1', [id]);
      if (listing.rows.length === 0) {
        skipped.push({ id, reason: 'not found' });
        continue;
      }

      const row = listing.rows[0];

      // Skip if already imported
      if (row.imported_to_contacts === 1) {
        skipped.push({ id, reason: 'already imported' });
        continue;
      }

      // Skip if no owner info
      if (!row.owner_name && !row.owner_email) {
        skipped.push({ id, reason: 'no owner data — enrich first' });
        continue;
      }

      // Generate personalized vacancy pain note
      const vacancyCostStr = row.estimated_vacancy_cost
        ? `$${Math.round(row.estimated_vacancy_cost).toLocaleString()}`
        : 'significant losses';
      const note = `SCRAPED LEAD: Property at ${row.address} has been listed for ${row.days_on_market} days — est. ${vacancyCostStr} in lost rent. ${row.property_type || 'Rental'} property, ${row.bedrooms || '?'}bd/${row.bathrooms || '?'}ba, listed at $${row.listed_price?.toLocaleString() || 'N/A'}/mo.`;

      // Check for existing contact with same email
      let contactId: number | null = null;
      if (row.owner_email) {
        const existing = await query('SELECT id FROM contacts WHERE email = $1', [row.owner_email]);
        if (existing.rows.length > 0) {
          contactId = existing.rows[0].id;
          // Update notes on existing contact
          await query(
            `UPDATE contacts SET notes = COALESCE(notes, '') || E'\n' || $1, updated_at = NOW() WHERE id = $2`,
            [note, contactId]
          );
        }
      }

      // Create new contact if no existing match
      if (!contactId) {
        const nameParts = (row.owner_name || 'Unknown Owner').split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        const insertResult = await query(
          `INSERT INTO contacts (
            first_name, last_name, name, title, email, email_status,
            phone, city, state, country,
            org_name, org_industry,
            source_template, contact_type, notes, status
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'new')
          RETURNING id`,
          [
            firstName,
            lastName,
            row.owner_name || 'Property Owner',
            row.owner_type === 'corporate' ? 'Property Manager' : 'Property Owner',
            row.owner_email,
            row.owner_email ? 'scraped' : null,
            row.owner_phone,
            row.city,
            row.state,
            'US',
            row.owner_type === 'corporate' ? row.owner_name : null,
            'Real Estate',
            'landlord-scraper',
            'landlord',
            note,
          ]
        );
        contactId = insertResult.rows[0].id;
      }

      // Mark listing as imported
      await query(
        `UPDATE listings SET imported_to_contacts = 1, contact_id = $1, updated_at = NOW() WHERE id = $2`,
        [contactId, id]
      );

      imported.push({
        listingId: id,
        contactId,
        address: row.address,
        ownerName: row.owner_name,
        ownerEmail: row.owner_email,
        daysOnMarket: row.days_on_market,
      });
    }

    return NextResponse.json({
      imported: imported.length,
      skipped: skipped.length,
      details: { imported, skipped },
    });
  } catch (error: any) {
    console.error('Scraper import error:', error);
    return NextResponse.json({ error: error.message || 'Import failed' }, { status: 500 });
  }
}
