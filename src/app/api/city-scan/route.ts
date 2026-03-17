import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { scanCity } from '@/lib/city-scan';
import { runBatchScan, getBatchProgress } from '@/lib/batch-scan';

export const maxDuration = 300; // 5 minutes

function validateAuth(req: NextRequest): boolean {
  const webhookSecret = process.env.SWEETLEASE_WEBHOOK_SECRET;
  const providedSecret = req.headers.get('x-webhook-secret');
  return !!(webhookSecret && providedSecret === webhookSecret);
}

export async function POST(req: NextRequest) {
  if (!validateAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();

    // Batch scan: { batch: true, cities: [...] }
    if (body.batch && Array.isArray(body.cities)) {
      const batchId = body.batchId || `batch-${Date.now()}`;

      // Fire-and-forget: start the batch in the background
      runBatchScan(batchId, body.cities).catch(err => {
        console.error(`[batch-scan] Fatal error in batch ${batchId}:`, err);
      });

      return NextResponse.json({
        batchId,
        totalCities: body.cities.length,
        message: 'Batch scan started. Poll GET /api/city-scan?batchId=... for progress.',
      });
    }

    // Single city scan
    const { city, state, bedroomsMin } = body;
    if (!city || !state) {
      return NextResponse.json({ error: 'city and state required' }, { status: 400 });
    }

    const result = await scanCity(city, state, bedroomsMin);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[city-scan] Error:', error);
    return NextResponse.json({ error: error.message || 'Scan failed' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const city = req.nextUrl.searchParams.get('city');
    const state = req.nextUrl.searchParams.get('state');
    const batchId = req.nextUrl.searchParams.get('batchId');

    // Batch progress
    if (batchId) {
      const progress = await getBatchProgress(batchId);
      return NextResponse.json(progress);
    }

    // City-specific landlords
    if (city && state) {
      const landlords = await query(
        `SELECT * FROM portfolio_landlords
         WHERE city = $1 AND state = $2
         ORDER BY portfolio_size DESC NULLS LAST, unit_count DESC`,
        [city, state]
      );
      const scan = await query(
        `SELECT * FROM city_scans WHERE city = $1 AND state = $2`,
        [city, state]
      );
      return NextResponse.json({ scan: scan.rows[0] || null, landlords: landlords.rows });
    }

    // List all scanned cities + any active batches
    const scans = await query(`SELECT * FROM city_scans ORDER BY completed_at DESC`).catch(() => ({ rows: [] }));
    const batches = await query(`SELECT * FROM batch_scans ORDER BY started_at DESC LIMIT 5`).catch(() => ({ rows: [] }));

    return NextResponse.json({ scans: scans.rows, batches: batches.rows });
  } catch (error: any) {
    return NextResponse.json({ scans: [], error: error.message });
  }
}
