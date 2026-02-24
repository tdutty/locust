import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

const TAVUS_API_KEY = process.env.TAVUS_API_KEY;
const TAVUS_PERSONA_ID = process.env.TAVUS_PERSONA_ID || 'pae953fafc44';
const TAVUS_REPLICA_ID = process.env.TAVUS_REPLICA_ID || 'r1a4e22fa0d9';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://locust-m7ng3.ondigitalocean.app';

/**
 * Fetch with 1 retry on 5xx errors, 1-second backoff.
 */
async function fetchWithRetry(url: string, options: RequestInit): Promise<Response> {
  const response = await fetch(url, options);
  if (response.status >= 500) {
    await new Promise(r => setTimeout(r, 1000));
    return fetch(url, options);
  }
  return response;
}

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

    // Add audience-specific guidance with structured qualification objectives
    if (booking.event_type === 'landlord') {
      contextParts.push('They are a landlord or property manager. Focus on vacancy fill rates, tenant quality, and the success fee model. QUALIFICATION OBJECTIVES: 1) Ask about portfolio size (how many units). 2) Ask about current vacancy rate or time-to-fill. 3) Understand current tenant sourcing process (what platforms they use, do they have a leasing team). 4) Determine timeline -- are they looking to fill units now or planning ahead? Ask these naturally throughout the conversation, not as a checklist.');
    } else if (booking.event_type === 'employer') {
      contextParts.push('They are from HR, People Ops, or handle employee relocations. Focus on the free service, employee rent savings, and relocation streamlining. QUALIFICATION OBJECTIVES: 1) Ask about relocation volume (how many employees relocate per year). 2) Understand current relocation process (do they use a relo company, what tools). 3) Ask about biggest pain points with current housing process. 4) Determine timeline -- upcoming hiring wave, Q1 planning, etc. Ask these naturally, not as a checklist.');
    } else if (booking.event_type === 'university') {
      contextParts.push('They are from a university housing office. Focus on zero cost, student savings, international student support, and the branded portal. QUALIFICATION OBJECTIVES: 1) Ask about student body size and what percentage lives off-campus. 2) Understand current housing resource process (do they have a housing portal, recommended landlord list). 3) Ask about biggest housing challenges (affordability, international students, supply). 4) Determine timeline -- orientation season, academic calendar milestones. Ask these naturally, not as a checklist.');
    } else if (booking.event_type === 'residency') {
      contextParts.push('They are from a medical residency program. Focus on zero cost, resident housing cost burden, and move-in coordination for July starts. QUALIFICATION OBJECTIVES: 1) Ask about incoming cohort size (how many residents per year). 2) Understand current housing resources provided (welcome packet, recommended list, nothing). 3) Ask about the biggest housing complaints from incoming residents. 4) Determine timeline -- Match Day is in March, residents need housing by late June. Ask these naturally, not as a checklist.');
    } else if (booking.event_type === 'benefits-platform') {
      contextParts.push('They are from a benefits or LSA platform. Focus on the new benefit category, first-mover advantage, and white-label integration. QUALIFICATION OBJECTIVES: 1) Ask about their employee/client count (how many companies on the platform, total employees served). 2) Understand current benefits stack (what categories they offer today). 3) Ask about integration approach (API, embedded, white-label). 4) Determine timeline -- product roadmap, next benefits enrollment period. Ask these naturally, not as a checklist.');
    }

    // Short greeting -- just a warm "hey". The rest comes naturally in conversation.
    // Tavus fires this once the participant joins the call.
    const greeting = `Hey ${firstName}.`;

    // Create Tavus conversation with retry
    const tavusResponse = await fetchWithRetry('https://tavusapi.com/v2/conversations', {
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
        callback_url: `${APP_URL}/api/webhooks/tavus`,
        properties: {
          max_call_duration: 900,
          participant_left_timeout: 60,
          participant_absent_timeout: 300,
          enable_closed_captions: true,
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

    // Log meeting_started to activity_log if a pipeline deal exists
    if (contactInfo) {
      try {
        const dealResult = await query(
          `SELECT id FROM pipeline_deals WHERE contact_id = $1 LIMIT 1`,
          [contactInfo.id]
        );
        if (dealResult.rows.length > 0) {
          await query(
            `INSERT INTO activity_log (deal_id, activity_type, description, metadata)
             VALUES ($1, $2, $3, $4)`,
            [
              dealResult.rows[0].id,
              'meeting_started',
              `AI video meeting started with ${booking.attendee_name}`,
              JSON.stringify({ conversation_id: tavusData.conversation_id, event_type: booking.event_type }),
            ]
          );
        }
      } catch {}
    }

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
