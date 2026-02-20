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

/** Branded email signature matching outbound campaigns */
function buildSignatureHtml(): string {
  return `
      <table cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;border-top:1px solid #e2e8f0;padding-top:16px;">
        <tr>
          <td style="vertical-align:top;font-family:Arial,sans-serif;">
            <p style="margin:0 0 8px 0;font-size:20px;font-weight:700;letter-spacing:-0.02em;line-height:1;">
              <span style="color:#EA580C;">SWEET</span><span style="color:#1a1a1a;">LEASE</span>
            </p>
            <p style="margin:0;font-size:14px;font-weight:600;color:#1a1a1a;">Terrell Gilbert</p>
            <p style="margin:2px 0 0;font-size:12px;color:#64748b;">Account Executive</p>
            <p style="margin:6px 0 0;font-size:12px;">
              <a href="https://sweetlease.io" style="color:#EA580C;text-decoration:none;">sweetlease.io</a>
              <span style="color:#cbd5e1;margin:0 6px;">|</span>
              <a href="mailto:tgilbert@sweetlease.io" style="color:#EA580C;text-decoration:none;">tgilbert@sweetlease.io</a>
            </p>
          </td>
        </tr>
      </table>`;
}

/** Wraps reply body text + HTML components into a full HTML email */
function buildFullHtmlEmail(textParagraphs: string[], availabilityHtml: string, pdfHtml: string, includeAvailability: boolean): string {
  const bodyParagraphs = textParagraphs.map(p => {
    if (p.includes('https://')) {
      return `<p style="margin:10px 0;font-size:15px;line-height:1.6;color:#333;"><a href="${p.trim()}" style="color:#EA580C;text-decoration:none;">${p.trim()}</a></p>`;
    }
    return `<p style="margin:10px 0;font-size:15px;line-height:1.6;color:#333;">${p}</p>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family:Arial,sans-serif;margin:0;padding:0;background-color:#ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:20px;">
    <tr>
      <td>
        ${bodyParagraphs}
        ${includeAvailability ? availabilityHtml : ''}
        ${pdfHtml}
        ${buildSignatureHtml()}
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

  return `You are writing a professional reply on behalf of Terrell Gilbert, Account Executive at SweetLease.

SweetLease connects independent landlords with relocating corporate employees. Key value props:
- For landlords: Fill vacancies 3x faster, pre-screened tenants with employer-backed guarantees, landlord has final say on pricing and tenant approval, commission 25% below industry standard, we integrate their existing listings for free
- For employers: Complimentary housing placement service, $100-300/month rent savings, zero cost to employer
- For universities/residency programs: Free housing resource for incoming students and residents

Today's date is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' })}.

Tone and style:
- Professional, polished, and business-appropriate. Write like a senior business development executive.
- Use complete sentences, proper grammar, and a respectful tone.
- Avoid slang, casual phrases, colloquialisms, and excessive exclamation marks.
- Do NOT use "I hope this finds you well" or filler greetings. Be direct and substantive.

Rules:
- Address their specific questions or concerns directly
- For interested leads: propose a call using ONLY these real available times from Calendly:
${slotText}
  Mention each time slot with its booking link. Also include the general Calendly link: ${CALENDLY_SCHEDULING_URL}
  Mention that you will also send over a partnership overview for their review.
  Offer to walk them through the platform and integrate their existing listings for free.
- For objections: acknowledge respectfully, provide value, suggest revisiting in the future
- For questions: answer with specific details and data points
- For not_interested: professionally remove them, leave the door open
- Do NOT include a signature block or sign-off — it is appended automatically
- Keep the body under 100 words (signature, scheduling table, and PDF link are added separately)
- End with "Best regards," on its own line — nothing after that`;
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
        ? slots.map(s => `- ${s.label}: ${s.scheduling_url}`).join('\n') + `\n\nAlternatively, you can view all available times here: ${CALENDLY_SCHEDULING_URL}`
        : `You can select a convenient time here: ${CALENDLY_SCHEDULING_URL}`;
      const body = `Dear ${firstName},\n\nThank you for your interest in SweetLease. I would welcome the opportunity to schedule a brief 30-minute call to discuss your specific needs and walk you through our platform.\n\nAs part of our onboarding, we will integrate your existing listings at no additional cost to get you up and running quickly.\n\nBelow are several available times for a conversation:\n${slotLines}\n\nI have also included a partnership overview below for your reference.\n\nBest regards,`;
      const paragraphs = [
        `Dear ${firstName},`,
        `Thank you for your interest in SweetLease. I would welcome the opportunity to schedule a brief 30-minute call to discuss your specific needs and walk you through our platform.`,
        `As part of our onboarding, we will integrate your existing listings at no additional cost to get you up and running quickly.`,
        `Below are several available times for a conversation:`,
      ];
      return { subject, body, paragraphs };
    }
    case 'question': {
      const bulletPoints = [
        'You have final say on pricing and tenant approval',
        'Our commission is 25% below the industry standard',
        'All tenants are pre-screened with employer-backed guarantees',
        'Average placement timeline: 14 days, compared to 45 days on traditional platforms',
        'We integrate your existing listings at no additional cost',
      ];
      const paragraphs = [
        `Dear ${firstName},`,
        `Thank you for your inquiry. I am happy to provide some additional detail on how SweetLease works:`,
        bulletPoints.map(b => `&#8226; ${b}`).join('<br style="margin-bottom:6px;">'),
        `I have included a detailed overview document below for your reference. I would also be glad to walk you through our platform and discuss relevant case studies at your convenience.`,
      ];
      const body = `Dear ${firstName},\n\nThank you for your inquiry. I am happy to provide some additional detail on how SweetLease works:\n\n${bulletPoints.map(b => `- ${b}`).join('\n')}\n\nI have included a detailed overview document below for your reference. I would also be glad to walk you through our platform and discuss relevant case studies at your convenience.\n\nBest regards,`;
      return { subject, body, paragraphs };
    }
    case 'objection': {
      const paragraphs = [
        `Dear ${firstName},`,
        `I appreciate you taking the time to respond, and I completely understand. Timing is an important factor in these decisions.`,
        `Many of our current partners began with a limited pilot — one or two units — with no long-term commitment required. This approach allows you to evaluate the results before making any broader decisions.`,
        `I will plan to follow up in a few months. In the meantime, I have included an overview document below should you wish to learn more at your own pace.`,
      ];
      const body = paragraphs.join('\n\n') + '\n\nBest regards,';
      return { subject, body, paragraphs };
    }
    case 'not_interested': {
      const paragraphs = [
        `Dear ${firstName},`,
        `Thank you for letting me know. I have removed you from our outreach list, and you will not receive further communications from us.`,
        `Should your circumstances change in the future, please do not hesitate to reach out. I wish you continued success.`,
      ];
      const body = paragraphs.join('\n\n') + '\n\nBest regards,';
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
