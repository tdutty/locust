import { NextResponse } from 'next/server';
import { getAllCreditStatus } from '@/lib/credit-monitor';

export const dynamic = 'force-dynamic';
export const maxDuration = 15;

/**
 * GET: Returns current credit status for all API services.
 * Called by Hive admin dashboard.
 * Times out after 12s and returns whatever we have.
 */
export async function GET() {
  try {
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 12000));
    const statusPromise = getAllCreditStatus();
    const status = await Promise.race([statusPromise, timeout]);

    if (status) {
      return NextResponse.json(status);
    }

    // Timed out — return empty status
    return NextResponse.json({
      hasdata: { credits: null, status: 'error', lastChecked: '', error: 'Timeout checking credits' },
      scrapeak: { credits: null, status: 'unknown', lastChecked: '' },
      batchdata: { credits: null, status: 'unknown', lastChecked: '' },
      apollo: { credits: null, status: 'unknown', lastChecked: '' },
      anthropic: { credits: null, status: 'error', lastChecked: '', error: 'Timeout checking credits' },
    });
  } catch (error: any) {
    console.error('[credit-status] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
