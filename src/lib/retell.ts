import Retell from 'retell-sdk';
import { query } from '@/lib/db';

const retellClient = new Retell({ apiKey: process.env.RETELL_API_KEY || '' });

/**
 * Build conversational context for the Retell agent — mirrors the Tavus context logic
 * from meeting/create/route.ts but adapted for phone calls.
 */
export async function buildConversationalContext(
  booking: any,
  contact: any | null,
  lastEmail: { subject: string; body: string } | null,
): Promise<string> {
  const firstName = booking.attendee_name.split(' ')[0];
  const contextParts: string[] = [];

  contextParts.push(`You are calling ${booking.attendee_name}. Their first name is ${firstName}. Use their first name naturally in conversation.`);

  if (contact) {
    if (contact.title) contextParts.push(`Their job title is ${contact.title}.`);
    if (contact.org_name) contextParts.push(`They work at ${contact.org_name}.`);
    if (contact.city && contact.state) contextParts.push(`They are based in ${contact.city}, ${contact.state}.`);
    if (contact.org_industry) contextParts.push(`Their organization is in the ${contact.org_industry} industry.`);
    if (contact.org_employee_count) contextParts.push(`Their company has approximately ${contact.org_employee_count} employees.`);
  }

  if (lastEmail) {
    contextParts.push(`IMPORTANT CONTEXT: They scheduled this call after receiving an email from you (Robert Gilbert) with the subject line: "${lastEmail.subject}". Here is what that email said: "${lastEmail.body.substring(0, 800)}". Reference this naturally. For example you might say "I know in my email I mentioned..." or "As I touched on in my note to you..." -- but do NOT read the email back to them. Use it to pick up where the email left off.`);
  } else {
    contextParts.push(`They booked a phone call to learn about SweetLease. You do not have context on what specific email they received, so start with discovery questions.`);
  }

  const eventType = contact?.contact_type || booking.event_type || 'landlord';

  if (eventType === 'landlord') {
    contextParts.push('They are a landlord or property manager. Focus on vacancy fill rates, tenant quality, and the success fee model. QUALIFICATION OBJECTIVES: 1) Ask about portfolio size (how many units). 2) Ask about current vacancy rate or time-to-fill. 3) Understand current tenant sourcing process (what platforms they use, do they have a leasing team). 4) Determine timeline -- are they looking to fill units now or planning ahead? Ask these naturally throughout the conversation, not as a checklist.');
  } else if (eventType === 'employer') {
    contextParts.push('They are from HR, People Ops, or handle employee relocations. Focus on the free service, employee rent savings, and relocation streamlining. QUALIFICATION OBJECTIVES: 1) Ask about relocation volume (how many employees relocate per year). 2) Understand current relocation process (do they use a relo company, what tools). 3) Ask about biggest pain points with current housing process. 4) Determine timeline -- upcoming hiring wave, Q1 planning, etc. Ask these naturally, not as a checklist.');
  } else if (eventType === 'university') {
    contextParts.push('They are from a university housing office. Focus on zero cost, student savings, international student support, and the branded portal. QUALIFICATION OBJECTIVES: 1) Ask about student body size and what percentage lives off-campus. 2) Understand current housing resource process (do they have a housing portal, recommended landlord list). 3) Ask about biggest housing challenges (affordability, international students, supply). 4) Determine timeline -- orientation season, academic calendar milestones. Ask these naturally, not as a checklist.');
  } else if (eventType === 'residency') {
    contextParts.push('They are from a medical residency program. Focus on zero cost, resident housing cost burden, and move-in coordination for July starts. QUALIFICATION OBJECTIVES: 1) Ask about incoming cohort size (how many residents per year). 2) Understand current housing resources provided (welcome packet, recommended list, nothing). 3) Ask about the biggest housing complaints from incoming residents. 4) Determine timeline -- Match Day is in March, residents need housing by late June. Ask these naturally, not as a checklist.');
  } else if (eventType === 'benefits-platform') {
    contextParts.push('They are from a benefits or LSA platform. Focus on the new benefit category, first-mover advantage, and white-label integration. QUALIFICATION OBJECTIVES: 1) Ask about their employee/client count (how many companies on the platform, total employees served). 2) Understand current benefits stack (what categories they offer today). 3) Ask about integration approach (API, embedded, white-label). 4) Determine timeline -- product roadmap, next benefits enrollment period. Ask these naturally, not as a checklist.');
  }

  return contextParts.join(' ');
}

/**
 * Look up the most recent email sent to an attendee.
 */
export async function findLastEmail(attendeeEmail: string): Promise<{ subject: string; body: string } | null> {
  // Check email_log first
  try {
    const result = await query(
      `SELECT subject, body FROM email_log
       WHERE LOWER(to_email) = LOWER($1)
       ORDER BY sent_at DESC LIMIT 1`,
      [attendeeEmail]
    );
    if (result.rows.length > 0) return result.rows[0];
  } catch {}

  // Fallback to scheduled_emails
  try {
    const result = await query(
      `SELECT subject, body FROM scheduled_emails
       WHERE LOWER(to_email) = LOWER($1) AND status = 'sent'
       ORDER BY sent_at DESC LIMIT 1`,
      [attendeeEmail]
    );
    if (result.rows.length > 0) return result.rows[0];
  } catch {}

  return null;
}

/**
 * Trigger an outbound phone call via Retell AI.
 */
export async function triggerOutboundCall(
  bookingId: number,
  toNumber: string,
  context: string,
  attendeeName: string,
): Promise<{ callId: string }> {
  const agentId = process.env.RETELL_AGENT_ID;
  const fromNumber = process.env.RETELL_PHONE_NUMBER;

  if (!agentId || !fromNumber) {
    throw new Error('RETELL_AGENT_ID and RETELL_PHONE_NUMBER must be configured');
  }

  const call = await retellClient.call.createPhoneCall({
    from_number: fromNumber,
    to_number: toNumber,
    override_agent_id: agentId,
    retell_llm_dynamic_variables: {
      attendee_name: attendeeName,
      first_name: attendeeName.split(' ')[0],
      conversational_context: context,
      booking_id: String(bookingId),
    },
  });

  return { callId: call.call_id };
}

/**
 * Verify a Retell webhook signature.
 */
export async function verifyRetellWebhook(body: string, signature: string): Promise<boolean> {
  const apiKey = process.env.RETELL_API_KEY;
  if (!apiKey) return false;

  try {
    return await Retell.verify(body, apiKey, signature);
  } catch {
    return false;
  }
}
