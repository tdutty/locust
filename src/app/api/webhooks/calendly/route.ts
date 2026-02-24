import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// Map Calendly event type slugs to our contact types
function mapEventType(eventTypeSlug: string, eventTypeName: string): string {
  const slug = (eventTypeSlug || '').toLowerCase();
  const name = (eventTypeName || '').toLowerCase();

  if (slug.includes('employer') || name.includes('employer')) return 'employer';
  if (slug.includes('university') || name.includes('university')) return 'university';
  if (slug.includes('residency') || name.includes('residency')) return 'residency';
  if (slug.includes('benefits') || name.includes('benefits')) return 'benefits-platform';
  if (slug.includes('intro') || name.includes('landlord')) return 'landlord';

  // Default based on Calendly event names
  if (name.includes('partner')) return 'university';
  return 'employer'; // default for general meetings
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const event = body.event; // "invitee.created" or "invitee.canceled"
    const payload = body.payload;

    if (!payload) {
      return NextResponse.json({ error: 'No payload' }, { status: 400 });
    }

    // Handle cancellations
    if (event === 'invitee.canceled') {
      const cancelUri = payload.uri || payload.event?.uri;
      if (cancelUri) {
        await query(
          `UPDATE meeting_bookings SET status = 'cancelled', updated_at = NOW() WHERE calendly_event_uri = $1`,
          [cancelUri]
        ).catch(() => {});
      }
      return NextResponse.json({ received: true, action: 'cancelled' });
    }

    // Handle new bookings (invitee.created)
    if (event !== 'invitee.created') {
      return NextResponse.json({ received: true, action: 'ignored' });
    }

    // Extract attendee info
    const attendeeName = payload.name || payload.invitee?.name || 'Guest';
    const attendeeEmail = payload.email || payload.invitee?.email || '';
    const scheduledAt = payload.event?.start_time || payload.scheduled_event?.start_time || new Date().toISOString();
    const eventUri = payload.event?.uri || payload.scheduled_event?.uri || '';
    const calendlyEventId = eventUri.split('/').pop() || `cal_${Date.now()}`;

    // Get event type info
    const eventTypeSlug = payload.event_type?.slug || payload.event_type_slug || '';
    const eventTypeName = payload.event_type?.name || payload.event_type_name || '';
    const contactType = mapEventType(eventTypeSlug, eventTypeName);

    // Upsert booking
    await query(
      `INSERT INTO meeting_bookings (calendly_event_id, attendee_name, attendee_email, event_type, scheduled_at, calendly_event_uri)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (calendly_event_id) DO UPDATE SET
         attendee_name = $2, attendee_email = $3, event_type = $4, scheduled_at = $5, updated_at = NOW()`,
      [calendlyEventId, attendeeName, attendeeEmail, contactType, scheduledAt, eventUri]
    );

    // Get the booking ID for the meeting page URL
    const result = await query(
      `SELECT id FROM meeting_bookings WHERE calendly_event_id = $1`,
      [calendlyEventId]
    );

    const bookingId = result.rows[0]?.id;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://locust-m7ng3.ondigitalocean.app';
    const meetingUrl = `${appUrl}/meeting/${bookingId}`;

    console.log(`Calendly booking received: ${attendeeName} (${attendeeEmail}) for ${contactType} at ${scheduledAt}`);
    console.log(`Meeting URL: ${meetingUrl}`);

    return NextResponse.json({
      received: true,
      booking_id: bookingId,
      meeting_url: meetingUrl,
      event_type: contactType,
    });
  } catch (error: any) {
    console.error('Calendly webhook error:', error);
    return NextResponse.json(
      { error: error.message || 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
