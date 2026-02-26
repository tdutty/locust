import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { buildConversationalContext, findLastEmail, triggerOutboundCall } from '@/lib/retell';

function validateCronAuth(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ') && authHeader.slice(7) === cronSecret) {
    return true;
  }

  const { searchParams } = new URL(request.url);
  return searchParams.get('secret') === cronSecret;
}

export async function GET(request: NextRequest) {
  if (!validateCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.RETELL_API_KEY || !process.env.RETELL_AGENT_ID || !process.env.RETELL_PHONE_NUMBER) {
    return NextResponse.json({ error: 'Retell not configured' }, { status: 500 });
  }

  try {
    // Find Cal.com bookings that are due (within 2 min window around scheduled time)
    const result = await query(
      `SELECT mb.*, c.id as matched_contact_id, c.contact_type, c.title as contact_title,
              c.org_name, c.city as contact_city, c.state as contact_state,
              c.org_industry, c.org_employee_count
       FROM meeting_bookings mb
       LEFT JOIN contacts c ON mb.contact_id = c.id OR LOWER(c.email) = LOWER(mb.attendee_email)
       WHERE mb.booking_source = 'calcom'
         AND mb.status = 'pending'
         AND mb.retell_call_id IS NULL
         AND mb.attendee_phone IS NOT NULL
         AND mb.scheduled_at <= NOW() + INTERVAL '2 minutes'
         AND mb.scheduled_at >= NOW() - INTERVAL '15 minutes'
       ORDER BY mb.scheduled_at ASC
       LIMIT 5`
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ triggered: 0, message: 'No calls due' });
    }

    let triggered = 0;
    let failed = 0;

    for (const booking of result.rows) {
      try {
        // Build contact object for context builder
        const contact = booking.matched_contact_id ? {
          title: booking.contact_title,
          org_name: booking.org_name,
          city: booking.contact_city,
          state: booking.contact_state,
          org_industry: booking.org_industry,
          org_employee_count: booking.org_employee_count,
          contact_type: booking.contact_type,
        } : null;

        const lastEmail = await findLastEmail(booking.attendee_email);
        const context = await buildConversationalContext(booking, contact, lastEmail);

        const { callId } = await triggerOutboundCall(
          booking.id,
          booking.attendee_phone,
          context,
          booking.attendee_name,
        );

        // Update booking with call ID and mark as active
        await query(
          `UPDATE meeting_bookings SET retell_call_id = $1, status = 'active', updated_at = NOW() WHERE id = $2`,
          [callId, booking.id]
        );

        console.log(`Retell call triggered: ${booking.attendee_name} (${booking.attendee_phone}) callId=${callId}`);
        triggered++;
      } catch (err: any) {
        console.error(`Failed to trigger call for booking ${booking.id}:`, err.message);
        failed++;
      }
    }

    return NextResponse.json({ triggered, failed, total: result.rows.length });
  } catch (error: any) {
    console.error('Trigger-calls cron error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to trigger calls' },
      { status: 500 }
    );
  }
}
