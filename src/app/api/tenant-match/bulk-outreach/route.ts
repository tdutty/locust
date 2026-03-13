import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getMaxSteps } from '@/lib/email-templates';

export async function POST(req: NextRequest) {
  try {
    const webhookSecret = process.env.SWEETLEASE_WEBHOOK_SECRET;
    const providedSecret = req.headers.get('x-webhook-secret');

    if (!webhookSecret || providedSecret !== webhookSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      batchId,
      listingId,
      landlordEmail,
      landlordName,
      propertyAddress,
      city,
      state,
      tenantCount,
      totalAnnualValue,
      averageBudget,
      earliestMoveIn,
      listingPrice,
    } = body;

    if (!batchId || !landlordEmail || !propertyAddress) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Upsert contact for landlord
    const existingContact = await query(
      `SELECT id FROM contacts WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [landlordEmail]
    );

    let contactId: number;

    if (existingContact.rows.length > 0) {
      contactId = existingContact.rows[0].id;
      await query(
        `UPDATE contacts SET notes = COALESCE(notes, '') || $1, updated_at = NOW() WHERE id = $2`,
        [`\nBULK TENANT MATCH: ${tenantCount} tenants interested in ${propertyAddress}. Total annual value: $${totalAnnualValue?.toLocaleString()}. Batch ID: ${batchId}`, contactId]
      );
    } else {
      const nameParts = (landlordName || 'Property Owner').split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;

      const newContact = await query(
        `INSERT INTO contacts (first_name, last_name, name, email, city, state, contact_type, source_template, status, notes)
         VALUES ($1, $2, $3, $4, $5, $6, 'tenant-match-bulk', 'tenant-match-bulk', 'new', $7)
         RETURNING id`,
        [
          firstName,
          lastName,
          landlordName || 'Property Owner',
          landlordEmail,
          city,
          state,
          `BULK TENANT MATCH: ${tenantCount} tenants for ${propertyAddress}. Avg budget: $${averageBudget}/mo. Total annual: $${totalAnnualValue}. Batch: ${batchId}`,
        ]
      );
      contactId = newContact.rows[0].id;
    }

    // Create contact_sequence with bulk type
    const maxSteps = getMaxSteps('tenant-match-bulk');
    const seqResult = await query(
      `INSERT INTO contact_sequences (contact_id, contact_type, current_step, max_steps, status, next_send_at)
       VALUES ($1, 'tenant-match-bulk', 0, $2, 'active', NOW())
       RETURNING id`,
      [contactId, maxSteps]
    );
    const sequenceId = seqResult.rows[0].id;

    // Create pipeline deal with aggregate value
    await query(
      `INSERT INTO pipeline_deals (name, company, contact_id, type, stage, value, probability, next_action, metadata)
       VALUES ($1, $2, $3, 'tenant-match-bulk', 'contacted', $4, 30, $5, $6)
       ON CONFLICT DO NOTHING`,
      [
        `Bulk Match: ${landlordName || 'Owner'} - ${propertyAddress} (${tenantCount} tenants)`,
        landlordName || 'Owner',
        contactId,
        Math.round(totalAnnualValue || averageBudget * 12 * tenantCount),
        `Awaiting landlord reply to bulk tenant-match email (${tenantCount} tenants)`,
        JSON.stringify({
          batchId,
          listingId,
          tenantCount,
          totalAnnualValue,
          averageBudget,
          earliestMoveIn,
          listingPrice,
          propertyAddress,
          city,
          state,
        }),
      ]
    );

    return NextResponse.json({
      contactId,
      sequenceId,
      batchId,
    });
  } catch (error: any) {
    console.error('Bulk outreach error:', error);
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
  }
}
