import Anthropic from '@anthropic-ai/sdk';

export interface OriginalEmail {
  from: string;
  fromEmail: string;
  subject: string;
  body: string;
  classification: 'interested' | 'objection' | 'not_interested' | 'question' | 'spam' | 'system';
  contactType?: string;
}

const CALENDLY_EVENT_TYPE = 'https://api.calendly.com/event_types/9855ae1b-631d-48c4-8089-78956bd85b7d';
const CALENDLY_SCHEDULING_URL = 'https://calendly.com/terrellgilb5/30min';
const APP_BASE_URL = 'https://locust-m7ng3.ondigitalocean.app';

// PDF docs mapped by contact type
const PDF_DOCS: Record<string, { label: string; path: string }> = {
  landlord: { label: 'SweetLease Landlord Overview', path: '/docs/sweetlease-landlord-overview.pdf' },
  employer: { label: 'SweetLease Employer Overview', path: '/docs/sweetlease-employer-overview.pdf' },
  university: { label: 'SweetLease University Housing Resource', path: '/docs/sweetlease-university-housing-resource.pdf' },
  residency: { label: 'SweetLease Residency Program Overview', path: '/docs/sweetlease-residency-program-overview.pdf' },
  'benefits-platform': { label: 'SweetLease Benefits Partnership Deck', path: '/docs/sweetlease-benefits-partnership-deck.pdf' },
  'graduate-housing': { label: 'SweetLease University Housing Resource', path: '/docs/sweetlease-university-housing-resource.pdf' },
};

interface CalendlySlot {
  label: string;
  scheduling_url: string;
}

/** Fetches 3 real available slots from Calendly API */
async function fetchCalendlySlots(): Promise<CalendlySlot[]> {
  const token = process.env.CALENDLY_API_TOKEN;
  if (!token) return [];

  try {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() + 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const url = `https://api.calendly.com/event_type_available_times?event_type=${encodeURIComponent(CALENDLY_EVENT_TYPE)}&start_time=${start.toISOString()}&end_time=${end.toISOString()}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      console.error('Calendly API error:', res.status);
      return [];
    }

    const data = await res.json();
    const available = data.collection || [];

    // Pick 3 slots spread across different days for variety
    const byDay = new Map<string, typeof available>();
    for (const slot of available) {
      const day = slot.start_time.slice(0, 10);
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day)!.push(slot);
    }

    // Target different times of day for variety
    const targetHoursUTC = [15, 18, 20]; // ~9-10am, ~12-1pm, ~2-3pm CT
    let targetIdx = 0;

    const picked: CalendlySlot[] = [];
    for (const [, daySlots] of byDay) {
      if (picked.length >= 3) break;
      const targetHour = targetHoursUTC[targetIdx % targetHoursUTC.length];
      targetIdx++;
      const slot = daySlots.reduce((best: any, s: any) => {
        const hour = new Date(s.start_time).getUTCHours();
        const bestHour = new Date(best.start_time).getUTCHours();
        return Math.abs(hour - targetHour) < Math.abs(bestHour - targetHour) ? s : best;
      });

      const dt = new Date(slot.start_time);
      const label = dt.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        timeZone: 'America/Chicago',
      }) + ' at ' + dt.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'America/Chicago',
      }) + ' CT';

      picked.push({ label, scheduling_url: slot.scheduling_url });
    }

    return picked;
  } catch (err) {
    console.error('Calendly fetch failed:', err);
    return [];
  }
}

/** Build HTML availability table */
function buildAvailabilityTableHtml(slots: CalendlySlot[]): string {
  if (slots.length === 0) {
    return `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
        <tr>
          <td align="center" style="padding:16px;">
            <a href="${CALENDLY_SCHEDULING_URL}" style="display:inline-block;background-color:#16a34a;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px;">
              View Available Times
            </a>
          </td>
        </tr>
      </table>`;
  }

  const rows = slots.map((s, i) => {
    const parts = s.label.split(' at ');
    const day = parts[0];
    const time = parts[1] || s.label;
    const bgColor = i % 2 === 0 ? '#f9fafb' : '#ffffff';
    return `
          <tr style="background-color:${bgColor};">
            <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#374151;">
              ${day}
            </td>
            <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;font-size:14px;font-weight:600;color:#111827;">
              ${time}
            </td>
            <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;text-align:center;">
              <a href="${s.scheduling_url}" style="display:inline-block;background-color:#16a34a;color:#ffffff;font-size:13px;font-weight:600;text-decoration:none;padding:8px 18px;border-radius:6px;">
                Book
              </a>
            </td>
          </tr>`;
  }).join('');

  return `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
        <thead>
          <tr style="background-color:#f0fdf4;">
            <th style="padding:12px 16px;text-align:left;font-size:13px;font-weight:600;color:#166534;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #16a34a;">
              Day
            </th>
            <th style="padding:12px 16px;text-align:left;font-size:13px;font-weight:600;color:#166534;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #16a34a;">
              Time
            </th>
            <th style="padding:12px 16px;text-align:center;font-size:13px;font-weight:600;color:#166534;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #16a34a;">
              &nbsp;
            </th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      <p style="margin:8px 0 0;font-size:13px;color:#6b7280;">
        None of these work? <a href="${CALENDLY_SCHEDULING_URL}" style="color:#16a34a;font-weight:500;">View all available times</a>
      </p>`;
}

/** Build HTML block for PDF doc link */
function buildPdfLinkHtml(contactType?: string): string {
  const doc = PDF_DOCS[contactType || 'landlord'] || PDF_DOCS.landlord;
  const url = `${APP_BASE_URL}${doc.path}`;

  return `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;">
        <tr>
          <td style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding-right:14px;vertical-align:middle;">
                  <div style="width:40px;height:40px;background-color:#fee2e2;border-radius:8px;text-align:center;line-height:40px;font-size:18px;">
                    &#128196;
                  </div>
                </td>
                <td style="vertical-align:middle;">
                  <p style="margin:0;font-size:14px;font-weight:600;color:#1e293b;">${doc.label}</p>
                  <p style="margin:4px 0 0;font-size:13px;color:#64748b;">
                    Prefer to read first?
                    <a href="${url}" style="color:#16a34a;font-weight:600;text-decoration:none;">Download PDF</a>
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>`;
}

/** Wraps reply body text + HTML components into a full HTML email */
function buildFullHtmlEmail(textParagraphs: string[], availabilityHtml: string, pdfHtml: string, includeAvailability: boolean): string {
  const bodyParagraphs = textParagraphs.map(p => {
    if (p.includes('https://')) {
      return `<p style="margin:10px 0;font-size:15px;line-height:1.6;color:#333;"><a href="${p.trim()}" style="color:#16a34a;">${p.trim()}</a></p>`;
    }
    return `<p style="margin:10px 0;font-size:15px;line-height:1.6;color:#333;">${p}</p>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;margin:0;padding:0;background-color:#ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:20px;">
    <tr>
      <td>
        ${bodyParagraphs}
        ${includeAvailability ? availabilityHtml : ''}
        ${pdfHtml}
        <table cellpadding="0" cellspacing="0" style="margin-top:24px;">
          <tr><td style="font-size:15px;color:#333;">Best,</td></tr>
          <tr><td style="font-size:15px;font-weight:600;color:#111;padding-top:4px;">Terrell Gilbert</td></tr>
          <tr><td style="font-size:14px;color:#16a34a;">SweetLease</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function getReplySystemPrompt(): Promise<string> {
  const slots = await fetchCalendlySlots();
  const slotText = slots.length > 0
    ? slots.map(s => `  - ${s.label} (book directly: ${s.scheduling_url})`).join('\n')
    : `  (Check availability: ${CALENDLY_SCHEDULING_URL})`;

  return `You are Locust, the AI Account Executive for SweetLease. You are writing a reply to an incoming email.

SweetLease connects independent landlords with relocating corporate employees. Key value props:
- For landlords: Fill vacancies 3x faster, pre-screened tenants with employer-backed guarantees
- For employers: $99.99 one-time employee fee, $100-300/month rent savings, zero cost to employer

Today's date is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' })}.

Rules:
- Be warm and conversational but concise
- Address their specific questions or concerns
- For interested leads: propose a call using ONLY these real available times from Calendly:
${slotText}
  Include the direct booking link for each time slot.
  Also include the general Calendly link: ${CALENDLY_SCHEDULING_URL}
- For objections: acknowledge, provide value, suggest future follow-up
- For questions: answer directly with specific details
- For not_interested: graciously remove them, leave door open
- Do NOT include a signature block — it will be added automatically
- Keep the body under 100 words (signature and scheduling table are added separately)
- Sign off as Terrell Gilbert, SweetLease`;
}

/** Generates reply with HTML body, Calendly table, and PDF link */
export async function generateReply(originalEmail: OriginalEmail): Promise<{ subject: string; body: string; htmlBody: string; source: string } | null> {
  if (originalEmail.classification === 'spam' || originalEmail.classification === 'system') return null;

  const contactType = originalEmail.contactType || 'landlord';
  const slots = await fetchCalendlySlots();
  const availabilityHtml = buildAvailabilityTableHtml(slots);
  const pdfHtml = buildPdfLinkHtml(contactType);
  const includeAvailability = originalEmail.classification === 'interested' || originalEmail.classification === 'question';

  // Try AI first
  const aiReply = await generateReplyWithAI(originalEmail);
  if (aiReply) {
    const textParagraphs = aiReply.body.split('\n').filter(l => l.trim());
    // Strip any AI-generated signature (everything after "Best," or "Terrell")
    const sigIdx = textParagraphs.findIndex(l => /^(best|regards|cheers|terrell|sweetlease)/i.test(l.trim()));
    const bodyParagraphs = sigIdx > 0 ? textParagraphs.slice(0, sigIdx) : textParagraphs;

    return {
      subject: aiReply.subject,
      body: aiReply.body,
      htmlBody: buildFullHtmlEmail(bodyParagraphs, availabilityHtml, pdfHtml, includeAvailability),
      source: 'ai',
    };
  }

  // Template fallback
  const { subject, body, paragraphs } = buildTemplateReply(originalEmail, slots);
  return {
    subject,
    body,
    htmlBody: buildFullHtmlEmail(paragraphs, availabilityHtml, pdfHtml, includeAvailability),
    source: 'template',
  };
}

function buildTemplateReply(email: OriginalEmail, slots: CalendlySlot[]): { subject: string; body: string; paragraphs: string[] } {
  const firstName = email.from.split(' ')[0];
  const subject = `Re: ${email.subject.replace(/^Re:\s*/i, '')}`;

  switch (email.classification) {
    case 'interested': {
      const slotLines = slots.length > 0
        ? slots.map(s => `- ${s.label}: ${s.scheduling_url}`).join('\n') + `\n\nOr pick another time: ${CALENDLY_SCHEDULING_URL}`
        : `Grab a time that works best: ${CALENDLY_SCHEDULING_URL}`;
      const body = `Hi ${firstName},\n\nThank you for your interest in SweetLease! I'd love to schedule a quick 30-minute call to learn more about your needs and show you how we can help.\n\nHere are a few times that work for me:\n${slotLines}\n\nLooking forward to connecting!`;
      const paragraphs = [
        `Hi ${firstName},`,
        `Thank you for your interest in SweetLease! I'd love to schedule a quick 30-minute call to learn more about your needs and show you how we can help.`,
        `Here are a few times that work for me:`,
      ];
      return { subject, body, paragraphs };
    }
    case 'question': {
      const paragraphs = [
        `Hi ${firstName},`,
        `Great question! Here's how SweetLease works:`,
        `&#8226; You set your rates, we bring qualified tenants<br>&#8226; No listing fees or commissions<br>&#8226; Tenants are pre-screened by their employers<br>&#8226; Average time to fill: 14 days vs 45 days on traditional platforms`,
        `I'd be happy to walk you through a few case studies. Would a quick call this week work?`,
      ];
      const body = `Hi ${firstName},\n\nGreat question! Here's how SweetLease works:\n\n- You set your rates, we bring qualified tenants\n- No listing fees or commissions\n- Tenants are pre-screened by their employers\n- Average time to fill: 14 days vs 45 days on traditional platforms\n\nI'd be happy to walk you through a few case studies. Would a quick call this week work?`;
      return { subject, body, paragraphs };
    }
    case 'objection': {
      const paragraphs = [
        `Hi ${firstName},`,
        `Completely understand. Timing is everything.`,
        `Many of our partners started with just one or two units to test the waters. No long-term commitment required.`,
        `I'll check back in a few months. In the meantime, feel free to reach out if anything changes.`,
      ];
      const body = paragraphs.join('\n\n');
      return { subject, body, paragraphs };
    }
    case 'not_interested': {
      const paragraphs = [
        `Hi ${firstName},`,
        `No problem at all. I've removed you from our outreach list.`,
        `If your situation ever changes, feel free to reach out anytime. Best of luck!`,
      ];
      const body = paragraphs.join('\n\n');
      return { subject, body, paragraphs };
    }
    default:
      return { subject, body: '', paragraphs: [] };
  }
}

async function generateReplyWithAI(originalEmail: OriginalEmail): Promise<{ subject: string; body: string } | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const client = new Anthropic({ apiKey });
    const systemPrompt = await getReplySystemPrompt();
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Write a reply to this email:

From: ${originalEmail.from} <${originalEmail.fromEmail}>
Subject: ${originalEmail.subject}
Classification: ${originalEmail.classification}

Body:
${originalEmail.body}

Respond in JSON: {"subject": "Re: ...", "body": "..."}`
      }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return null;
  } catch (err) {
    console.error('Claude AI reply generation failed, using template:', err);
    return null;
  }
}

export function getSuggestedAction(classification: string): string {
  switch (classification) {
    case 'interested': return 'Schedule a call within 24 hours to maintain momentum';
    case 'question': return 'Respond within 4 hours with helpful information';
    case 'objection': return 'Follow up in 2-3 months with a value-focused message';
    case 'not_interested': return 'Remove from active sequences, add to long-term nurture';
    default: return 'Review and take appropriate action';
  }
}
