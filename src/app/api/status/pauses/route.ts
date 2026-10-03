import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/status/pauses (2026-10-03)
 * Read-only status of Locust's paused senders, for SweetLease's admin
 * "Paused & Archived" page. Auth: x-webhook-secret = SWEETLEASE_WEBHOOK_SECRET.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.SWEETLEASE_WEBHOOK_SECRET;
  if (!secret || request.headers.get('x-webhook-secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const count = async (sql: string) => {
    try { return Number((await query(sql)).rows[0]?.n ?? 0); } catch { return null; }
  };
  return NextResponse.json({
    emailSendingEnabled: process.env.EMAIL_SENDING_ENABLED === 'true',
    aiCallsEnabled: process.env.AI_CALLS_ENABLED === 'true',
    queuedEmails: await count(`SELECT count(*) AS n FROM scheduled_emails WHERE status = 'pending'`),
    activeSequences: await count(`SELECT count(*) AS n FROM contact_sequences WHERE status = 'active'`),
    upcomingCallBookings: await count(`SELECT count(*) AS n FROM meeting_bookings WHERE status = 'pending' AND retell_call_id IS NULL AND scheduled_at > NOW()`),
  });
}
