import { NextResponse } from 'next/server';
import { checkHasData, checkAnthropic, getCachedStatus } from '@/lib/credit-monitor';

export const dynamic = 'force-dynamic';
export const maxDuration = 25;

/**
 * GET: Returns current credit status for all API services.
 * Runs checks sequentially to avoid cold start + parallel fetch issues.
 */
export async function GET() {
  try {
    // Run checks one at a time to avoid overwhelming cold-start resources
    try { await checkHasData(); } catch {}
    try { await checkAnthropic(); } catch {}

    return NextResponse.json(getCachedStatus());
  } catch (error: any) {
    console.error('[credit-status] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
