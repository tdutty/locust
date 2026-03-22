import { NextRequest, NextResponse } from 'next/server';
import { enrichContactBatch, type EnrichmentRequest } from '@/lib/contact-enrichment';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // Up to 2 min for batch enrichment

const WEBHOOK_SECRET = process.env.SWEETLEASE_WEBHOOK_SECRET || process.env.LOCUST_WEBHOOK_SECRET || '';

/**
 * POST: Enrich contact info for a batch of listings.
 * Called by SweetLease when tenants confirm selections or demand threshold is met.
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check
    const secret = request.headers.get('x-webhook-secret');
    if (WEBHOOK_SECRET && secret !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { listings, matchRequestId } = body;

    if (!listings || !Array.isArray(listings) || listings.length === 0) {
      return NextResponse.json({ error: 'listings array required' }, { status: 400 });
    }

    if (listings.length > 20) {
      return NextResponse.json({ error: 'Max 20 listings per batch' }, { status: 400 });
    }

    console.log(`[enrich-contacts] Enriching ${listings.length} listings for matchRequest=${matchRequestId || 'unknown'}`);

    const requests: EnrichmentRequest[] = listings.map((l: any) => ({
      sweetleaseListingId: l.sweetleaseListingId,
      address: l.address,
      city: l.city,
      state: l.state,
      zip: l.zip || '',
      zillowUrl: l.zillowUrl,
      zpid: l.zpid,
    }));

    const results = await enrichContactBatch(requests);

    const enriched = results.filter(r => r.contactSource !== 'none').length;
    const totalCost = results.reduce((sum, r) => sum + r.strategies.reduce((s, st) => s + st.cost, 0), 0);

    console.log(`[enrich-contacts] Done: ${enriched}/${results.length} enriched, cost=$${totalCost.toFixed(3)}`);

    return NextResponse.json({
      results: results.map(r => ({
        sweetleaseListingId: r.sweetleaseListingId,
        ownerName: r.ownerName,
        ownerEmail: r.ownerEmail,
        ownerPhone: r.ownerPhone,
        ownerType: r.ownerType,
        agentName: r.agentName,
        agentPhone: r.agentPhone,
        brokerName: r.brokerName,
        contactSource: r.contactSource,
        confidence: r.confidence,
      })),
      enriched,
      total: results.length,
      totalCost: Math.round(totalCost * 1000) / 1000,
    });
  } catch (error: any) {
    console.error('[enrich-contacts] Error:', error);
    return NextResponse.json({ error: error.message || 'Enrichment failed' }, { status: 500 });
  }
}
