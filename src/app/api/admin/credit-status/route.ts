import { NextResponse } from 'next/server';
import { getAllCreditStatus } from '@/lib/credit-monitor';

export const dynamic = 'force-dynamic';

/**
 * GET: Returns current credit status for all API services.
 * Called by Hive admin dashboard.
 */
export async function GET() {
  try {
    const status = await getAllCreditStatus();
    return NextResponse.json(status);
  } catch (error: any) {
    console.error('[credit-status] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
