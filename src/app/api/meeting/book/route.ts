import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// Create a meeting booking manually (no Calendly webhook needed)
// POST /api/meeting/book
// Body: { attendee_name, attendee_email, event_type, scheduled_at? }
// Returns: { booking_id, meeting_url }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { attendee_name, attendee_email, event_type, scheduled_at } = body;

    if (!attendee_name || !attendee_email) {
      return NextResponse.json(
        { error: 'attendee_name and attendee_email are required' },
        { status: 400 }
      );
    }

    const contactType = event_type || 'employer';
    const scheduledTime = scheduled_at || new Date().toISOString();
    const calendlyEventId = `manual_${Date.now()}`;

    const result = await query(
      `INSERT INTO meeting_bookings (calendly_event_id, attendee_name, attendee_email, event_type, scheduled_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [calendlyEventId, attendee_name, attendee_email, contactType, scheduledTime]
    );

    const bookingId = result.rows[0].id;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://locust-m7ng3.ondigitalocean.app';
    const meetingUrl = `${appUrl}/meeting/${bookingId}`;

    return NextResponse.json({
      booking_id: bookingId,
      meeting_url: meetingUrl,
      event_type: contactType,
    });
  } catch (error: any) {
    console.error('Meeting book error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create booking' },
      { status: 500 }
    );
  }
}
