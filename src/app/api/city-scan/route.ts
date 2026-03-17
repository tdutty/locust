import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { scanCity } from '@/lib/city-scan';

export const maxDuration = 300; // 5 minutes

export async function POST(req: NextRequest) {
  try {
    const webhookSecret = process.env.SWEETLEASE_WEBHOOK_SECRET;
    const providedSecret = req.headers.get('x-webhook-secret');

    if (!webhookSecret || providedSecret !== webhookSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { city, state, bedroomsMin } = await req.json();

    if (!city || !state) {
      return NextResponse.json({ error: 'city and state required' }, { status: 400 });
    }

    // Run scan (this takes 1-3 minutes)
    const result = await scanCity(city, state, bedroomsMin);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[city-scan] Error:', error);
    return NextResponse.json({ error: error.message || 'Scan failed' }, { status: 500 });
  }
}

// GET: List scanned cities and their portfolio landlords
export async function GET(req: NextRequest) {
  try {
    const city = req.nextUrl.searchParams.get('city');
    const state = req.nextUrl.searchParams.get('state');

    if (city && state) {
      // Get portfolio landlords for a specific city
      const landlords = await query(
        `SELECT * FROM portfolio_landlords
         WHERE city = $1 AND state = $2
         ORDER BY unit_count DESC, portfolio_size DESC`,
        [city, state]
      );

      const scan = await query(
        `SELECT * FROM city_scans WHERE city = $1 AND state = $2`,
        [city, state]
      );

      return NextResponse.json({
        scan: scan.rows[0] || null,
        landlords: landlords.rows,
      });
    }

    // List all scanned cities
    const scans = await query(
      `SELECT * FROM city_scans ORDER BY completed_at DESC`
    );

    return NextResponse.json({ scans: scans.rows });
  } catch (error: any) {
    // Tables might not exist yet
    return NextResponse.json({ scans: [], error: error.message });
  }
}
