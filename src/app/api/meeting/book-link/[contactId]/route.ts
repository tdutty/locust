import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://locust-m7ng3.ondigitalocean.app';

export async function GET(
  request: NextRequest,
  { params }: { params: { contactId: string } },
) {
  try {
    const contactId = parseInt(params.contactId);
    if (isNaN(contactId)) {
      return NextResponse.json({ error: 'Invalid contact ID' }, { status: 400 });
    }

    // Look up contact
    const contactResult = await query(
      `SELECT id, name, email, contact_type FROM contacts WHERE id = $1`,
      [contactId]
    );

    if (contactResult.rows.length === 0) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    const contact = contactResult.rows[0];

    // Check for existing pending booking within 24h to prevent duplicates
    const existingBooking = await query(
      `SELECT id FROM meeting_bookings
       WHERE LOWER(attendee_email) = LOWER($1)
         AND status IN ('pending', 'active')
         AND created_at > NOW() - INTERVAL '24 hours'
       ORDER BY created_at DESC
       LIMIT 1`,
      [contact.email]
    );

    if (existingBooking.rows.length > 0) {
      // Redirect to existing meeting
      return NextResponse.redirect(`${APP_URL}/meeting/${existingBooking.rows[0].id}`, 302);
    }

    // Create new meeting_bookings entry
    const eventType = contact.contact_type || 'employer';
    const newBooking = await query(
      `INSERT INTO meeting_bookings (calendly_event_id, attendee_name, attendee_email, event_type, scheduled_at, contact_id)
       VALUES ($1, $2, $3, $4, NOW(), $5)
       RETURNING id`,
      [
        `instant_${contactId}_${Date.now()}`,
        contact.name,
        contact.email,
        eventType,
        contactId,
      ]
    );

    const bookingId = newBooking.rows[0].id;

    // 302 redirect to the meeting page
    return NextResponse.redirect(`${APP_URL}/meeting/${bookingId}`, 302);
  } catch (error: any) {
    console.error('Book-link error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create meeting link' },
      { status: 500 }
    );
  }
}
