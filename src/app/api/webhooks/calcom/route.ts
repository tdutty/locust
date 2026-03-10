import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const triggerEvent = body.triggerEvent;
    const payload = body.payload;

    if (!payload) {
      return NextResponse.json({ error: 'No payload' }, { status: 400 });
    }

    // BOOKING_CANCELLED
    if (triggerEvent === 'BOOKING_CANCELLED') {
      const uid = payload.uid;
      if (uid) {
        await query(
          `UPDATE meeting_bookings SET status = 'cancelled', updated_at = NOW() WHERE calendly_event_id = $1`,
          [`calcom_${uid}`]
        ).catch(() => {});
      }
      return NextResponse.json({ received: true, action: 'cancelled' });
    }

    // BOOKING_RESCHEDULED
    if (triggerEvent === 'BOOKING_RESCHEDULED') {
      const uid = payload.uid;
      const newStart = payload.startTime;
      if (uid && newStart) {
        await query(
          `UPDATE meeting_bookings SET scheduled_at = $1, status = 'pending', updated_at = NOW() WHERE calendly_event_id = $2`,
          [newStart, `calcom_${uid}`]
        ).catch(() => {});
      }
      return NextResponse.json({ received: true, action: 'rescheduled' });
    }

    // BOOKING_CREATED
    if (triggerEvent !== 'BOOKING_CREATED') {
      return NextResponse.json({ received: true, action: 'ignored' });
    }

    // Extract attendee info from Cal.com payload
    const attendees = payload.attendees || [];
    const attendee = attendees[0] || {};
    const attendeeName = attendee.name || 'Guest';
    const attendeeEmail = attendee.email || '';
    const attendeePhone =
      attendee.phone ||
      payload.responses?.attendeePhoneNumber ||
      payload.responses?.phone?.value ||
      payload.responses?.location?.optionValue ||
      '';
    const scheduledAt = payload.startTime || new Date().toISOString();
    const uid = payload.uid || `calcom_${Date.now()}`;
    const calcomEventId = `calcom_${uid}`;

    // Determine contact type by looking up the contact
    let contactType = 'landlord';
    let contactId: number | null = null;

    if (attendeeEmail) {
      try {
        // Direct email match
        const contactResult = await query(
          `SELECT id, contact_type FROM contacts WHERE LOWER(email) = LOWER($1) LIMIT 1`,
          [attendeeEmail]
        );
        if (contactResult.rows.length > 0) {
          contactId = contactResult.rows[0].id;
          contactType = contactResult.rows[0].contact_type || contactType;
        } else {
          // Fallback: match by email domain (handles forwarded leads like Kyle@studentdoctor.net → Laura Turner)
          const domain = attendeeEmail.split('@')[1];
          if (domain) {
            const domainResult = await query(
              `SELECT id, contact_type FROM contacts WHERE LOWER(email) LIKE '%@' || $1 ORDER BY id ASC LIMIT 1`,
              [domain.toLowerCase()]
            );
            if (domainResult.rows.length > 0) {
              contactId = domainResult.rows[0].id;
              contactType = domainResult.rows[0].contact_type || contactType;
            }
          }
        }
      } catch {}
    }

    // Upsert booking
    await query(
      `INSERT INTO meeting_bookings (calendly_event_id, attendee_name, attendee_email, attendee_phone, event_type, scheduled_at, booking_source, contact_id)
       VALUES ($1, $2, $3, $4, $5, $6, 'calcom', $7)
       ON CONFLICT (calendly_event_id) DO UPDATE SET
         attendee_name = $2, attendee_email = $3, attendee_phone = $4, event_type = $5, scheduled_at = $6, booking_source = 'calcom', contact_id = $7, updated_at = NOW()`,
      [calcomEventId, attendeeName, attendeeEmail, attendeePhone || null, contactType, scheduledAt, contactId]
    );

    const result = await query(
      `SELECT id FROM meeting_bookings WHERE calendly_event_id = $1`,
      [calcomEventId]
    );

    const bookingId = result.rows[0]?.id;

    console.log(`Cal.com booking received: ${attendeeName} (${attendeeEmail}) phone=${attendeePhone} for ${contactType} at ${scheduledAt}`);

    return NextResponse.json({
      received: true,
      booking_id: bookingId,
      event_type: contactType,
    });
  } catch (error: any) {
    console.error('Cal.com webhook error:', error);
    return NextResponse.json(
      { error: error.message || 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
