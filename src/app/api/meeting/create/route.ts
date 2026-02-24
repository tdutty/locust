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

    // Look up contact and email history for this attendee
    let contactInfo: any = null;
    let lastEmailSubject = '';
    let lastEmailBody = '';

    try {
      const contactResult = await query(
        `SELECT * FROM contacts WHERE LOWER(email) = LOWER($1) LIMIT 1`,
        [booking.attendee_email]
      );
      if (contactResult.rows.length > 0) {
        contactInfo = contactResult.rows[0];
      }
    } catch {}

    // Find the most recent email we sent to this person
    try {
      const emailResult = await query(
        `SELECT subject, body FROM email_log
         WHERE LOWER(to_email) = LOWER($1)
         ORDER BY sent_at DESC LIMIT 1`,
        [booking.attendee_email]
      );
      if (emailResult.rows.length > 0) {
        lastEmailSubject = emailResult.rows[0].subject;
        lastEmailBody = emailResult.rows[0].body;
      }
    } catch {}

    // Also check scheduled_emails if email_log had nothing
    if (!lastEmailSubject) {
      try {
        const schedResult = await query(
          `SELECT subject, body FROM scheduled_emails
           WHERE LOWER(to_email) = LOWER($1) AND status = 'sent'
           ORDER BY sent_at DESC LIMIT 1`,
          [booking.attendee_email]
        );
        if (schedResult.rows.length > 0) {
          lastEmailSubject = schedResult.rows[0].subject;
          lastEmailBody = schedResult.rows[0].body;
        }
      } catch {}
    }

    // Build rich context
    const firstName = booking.attendee_name.split(' ')[0];
    const contextParts: string[] = [];

    contextParts.push(`The person joining this call is ${booking.attendee_name}. Their first name is ${firstName}. Use their first name naturally in conversation.`);

    // Add contact details if we have them
    if (contactInfo) {
      if (contactInfo.title) contextParts.push(`Their job title is ${contactInfo.title}.`);
      if (contactInfo.org_name) contextParts.push(`They work at ${contactInfo.org_name}.`);
      if (contactInfo.city && contactInfo.state) contextParts.push(`They are based in ${contactInfo.city}, ${contactInfo.state}.`);
      if (contactInfo.org_industry) contextParts.push(`Their organization is in the ${contactInfo.org_industry} industry.`);
      if (contactInfo.org_employee_count) contextParts.push(`Their company has approximately ${contactInfo.org_employee_count} employees.`);
    }

    // Add email context
    if (lastEmailSubject && lastEmailBody) {
      contextParts.push(`IMPORTANT CONTEXT: They are on this call because they received an email from you (Robert Gilbert) with the subject line: "${lastEmailSubject}". Here is what that email said: "${lastEmailBody.substring(0, 800)}". Reference this naturally. For example you might say "I know in my email I mentioned..." or "As I touched on in my note to you..." -- but do NOT read the email back to them. Use it to pick up where the email left off.`);
    } else {
      contextParts.push(`They booked a ${booking.event_type} meeting. You do not have context on what specific email they received, so start with discovery questions.`);
    }

    // Add audience-specific guidance
    if (booking.event_type === 'landlord') {
      contextParts.push('They are a landlord or property manager. Focus on vacancy fill rates, tenant quality, and the success fee model. Ask about their portfolio and current vacancy challenges.');
    } else if (booking.event_type === 'employer') {
      contextParts.push('They are from HR, People Ops, or handle employee relocations. Focus on the free service, employee rent savings, and relocation streamlining. Ask about their relocation volume and current process.');
    } else if (booking.event_type === 'university') {
      contextParts.push('They are from a university housing office. Focus on zero cost, student savings, international student support, and the branded portal. Ask about their student housing challenges.');
    } else if (booking.event_type === 'residency') {
      contextParts.push('They are from a medical residency program. Focus on zero cost, resident housing cost burden, and move-in coordination for July starts. Ask about their incoming cohort size.');
    } else if (booking.event_type === 'benefits-platform') {
      contextParts.push('They are from a benefits or LSA platform. Focus on the new benefit category, first-mover advantage, and white-label integration.');
    }

    // Short greeting -- just a warm "hey". The rest comes naturally in conversation.
    // Tavus fires this once the participant joins the call.
    const greeting = `Hey ${firstName}.`;

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
          max_call_duration: 900,
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
