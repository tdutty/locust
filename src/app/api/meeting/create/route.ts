import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

const TAVUS_API_KEY = process.env.TAVUS_API_KEY;
const TAVUS_PERSONA_ID = process.env.TAVUS_PERSONA_ID || 'pae953fafc44';
const TAVUS_REPLICA_ID = process.env.TAVUS_REPLICA_ID || 'r1a4e22fa0d9';

export async function POST(request: NextRequest) {
  try {
    const { bookingId } = await request.json();

    if (!bookingId) {
      return NextResponse.json({ error: 'Missing bookingId' }, { status: 400 });
    }

    if (!TAVUS_API_KEY) {
      return NextResponse.json({ error: 'Tavus API key not configured' }, { status: 500 });
    }

    // Look up booking
    const result = await query(
      `SELECT * FROM meeting_bookings WHERE id = $1`,
      [bookingId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const booking = result.rows[0];

    // If conversation already exists, return it
    if (booking.tavus_conversation_url && booking.status === 'active') {
      return NextResponse.json({
        conversation_url: booking.tavus_conversation_url,
        conversation_id: booking.tavus_conversation_id,
      });
    }

    // Build context for Robert Gilbert based on attendee info
    const contextParts = [
      `The person joining this call is ${booking.attendee_name}.`,
      `Their email is ${booking.attendee_email}.`,
      `They booked a ${booking.event_type} meeting.`,
    ];

    if (booking.event_type === 'landlord') {
      contextParts.push('They are likely a landlord or property manager. Focus on vacancy fill rates, tenant quality, and the success fee model.');
    } else if (booking.event_type === 'employer') {
      contextParts.push('They are likely from HR or People Ops. Focus on the free service, employee rent savings, and relocation streamlining.');
    } else if (booking.event_type === 'university') {
      contextParts.push('They are likely from a university housing office. Focus on zero cost, student savings, international student support, and the branded portal.');
    } else if (booking.event_type === 'residency') {
      contextParts.push('They are likely from a medical residency program. Focus on zero cost, resident housing cost burden, and move-in coordination for July starts.');
    } else if (booking.event_type === 'benefits-platform') {
      contextParts.push('They are likely from a benefits or LSA platform. Focus on the new benefit category, first-mover advantage, and white-label integration.');
    }

    const greeting = `Thanks for joining me today, ${booking.attendee_name.split(' ')[0]}. I'm Robert Gilbert with SweetLease. I appreciate you taking the time. Before I dive in, I'd love to hear a bit about you and what brought you to the call.`;

    // Create Tavus conversation
    const tavusResponse = await fetch('https://tavusapi.com/v2/conversations', {
      method: 'POST',
      headers: {
        'x-api-key': TAVUS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        persona_id: TAVUS_PERSONA_ID,
        replica_id: TAVUS_REPLICA_ID,
        conversation_name: `SweetLease - ${booking.attendee_name} (${booking.event_type})`,
        conversational_context: contextParts.join(' '),
        custom_greeting: greeting,
        properties: {
          max_call_duration: 900, // 15 minutes
          participant_left_timeout: 60,
          participant_absent_timeout: 300,
        },
      }),
    });

    if (!tavusResponse.ok) {
      const err = await tavusResponse.text();
      console.error('Tavus API error:', err);
      return NextResponse.json({ error: 'Failed to create conversation', details: err }, { status: 502 });
    }

    const tavusData = await tavusResponse.json();

    // Update booking with conversation details
    await query(
      `UPDATE meeting_bookings SET
        tavus_conversation_id = $1,
        tavus_conversation_url = $2,
        status = 'active',
        updated_at = NOW()
       WHERE id = $3`,
      [tavusData.conversation_id, tavusData.conversation_url, bookingId]
    );

    return NextResponse.json({
      conversation_url: tavusData.conversation_url,
      conversation_id: tavusData.conversation_id,
    });
  } catch (error: any) {
    console.error('Meeting create error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create meeting' },
      { status: 500 }
    );
  }
}
