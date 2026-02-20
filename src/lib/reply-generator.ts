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
                  <div style="width:40px;height:40px;background-color:#FFF7ED;border-radius:8px;text-align:center;line-height:40px;font-size:18px;">
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

export async function getReplySystemPrompt(contactType?: string): Promise<string> {
  const slots = await fetchCalendlySlots();
  const slotText = slots.length > 0
    ? slots.map(s => `  - ${s.label} (book directly: ${s.scheduling_url})`).join('\n')
    : `  (Check availability: ${CALENDLY_SCHEDULING_URL})`;

  const type = contactType || 'landlord';
  let audienceContext: string;
  let interestedRules: string;

  switch (type) {
    case 'employer':
    case 'benefits-platform':
      audienceContext = `You are replying to an EMPLOYER or HR contact. They are interested in SweetLease as a housing benefit for their relocating employees.
Key value props for employers:
- Complimentary housing placement service — zero cost to the employer
- Employees save $100–$300/month on rent
- We handle the full search, vetting, and placement process end-to-end
- Reduces relocation friction and improves employee satisfaction
- Quick setup — we can begin placing employees within days`;
      interestedRules = `For interested leads: propose a call to discuss how SweetLease can support their relocating workforce. Emphasize zero cost to employer and employee savings.`;
      break;
    case 'university':
    case 'residency':
    case 'graduate-housing':
      audienceContext = `You are replying to a UNIVERSITY, RESIDENCY PROGRAM, or GRADUATE HOUSING contact. They are interested in SweetLease as a housing resource for incoming students or residents.
Key value props for institutions:
- Free housing resource for incoming students and residents — zero cost to the institution
- We connect residents with pre-screened landlords offering furnished and unfurnished options
- We negotiate lease terms on behalf of residents, securing rates significantly below market average
- Full end-to-end service: search, vetting, negotiation, and placement
- Reduces housing-related stress and attrition for incoming cohorts with minimal administrative effort
- Quick setup — branded housing portal operational within days of partnership approval`;
      interestedRules = `For interested leads: propose a call to discuss how SweetLease can serve as a housing resource for their program. Emphasize it's completely free, we negotiate below-market rates, and requires minimal administrative effort.`;
      break;
    default: // landlord
      audienceContext = `You are replying to a LANDLORD or PROPERTY MANAGER. They are interested in SweetLease to fill vacancies faster.
Key value props for landlords:
- Fill vacancies 3x faster with pre-screened, employer-backed tenants
- Landlord has final say on pricing and tenant approval
- Commission 25% below industry standard
- We integrate their existing listings for free
- Quick onboarding — up and running in days`;
      interestedRules = `For interested leads: propose a call to walk them through the platform. Offer to integrate their existing listings for free. Emphasize the speed and quality of tenants.`;
      break;
  }

  return `You are writing a professional reply on behalf of Terrell Gilbert, Account Executive at SweetLease.

SweetLease connects independent landlords with relocating corporate employees.

${audienceContext}

Today's date is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' })}.

Tone and style:
- Professional, polished, and business-appropriate. Write like a senior business development executive.
- Use complete sentences, proper grammar, and a respectful tone.
- Avoid slang, casual phrases, colloquialisms, and excessive exclamation marks.
- Do NOT use "I hope this finds you well" or filler greetings. Be direct and substantive.
- If the contact name looks like an organization or department (e.g. "Tesla HR"), address them as "Dear Tesla HR" — do NOT split it.

Rules:
- Address their specific questions or concerns directly
- ${interestedRules}
  Use ONLY these real available times from Calendly:
${slotText}
  Mention each time slot with its booking link. Also include the general Calendly link: ${CALENDLY_SCHEDULING_URL}
  Mention that you will also send over a partnership overview for their review.
- For objections: acknowledge respectfully, provide value, suggest revisiting in the future
- For questions: answer with specific details and data points relevant to their type (employer/university/landlord)
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
    // Strip any AI-generated signature (everything after "Best regards," etc.)
    const sigIdx = textParagraphs.findIndex(l => /^(best regards|best,|regards,|warm regards|sincerely|cheers,|terrell gilbert|— terrell|--\s*$)/i.test(l.trim()));
    const trimmed = sigIdx > 0 ? textParagraphs.slice(0, sigIdx) : textParagraphs;
    // Strip AI-generated Calendly slot lines and related text — we render these in the HTML table
    const bodyParagraphs = trimmed.filter(l => {
      const t = l.trim();
      // Lines containing calendly.com URLs
      if (/calendly\.com/i.test(t)) return false;
      // Slot lines like "Friday, February 20 at 9:00 AM CT" or "• Monday..."
      if (/\d{1,2}:\d{2}\s*(AM|PM)\s*CT/i.test(t)) return false;
      // "Alternatively" / "Or select another time" / "view all available times"
      if (/^(alternatively|or select|view all available)/i.test(t)) return false;
      // "I have availability" / "available times" intro lines
      if (/\b(i have availability|available times|here are.*times)\b/i.test(t)) return false;
      // "partnership overview for your review" / "I'll also send over"
      if (/partnership overview/i.test(t)) return false;
      return true;
    });

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

/** Extracts a proper greeting name — uses full name for orgs/departments, first name for individuals */
function getGreetingName(from: string): string {
  const lower = from.toLowerCase();
  // If it looks like a department or org name (contains HR, Team, Office, Admin, etc.), use full name
  if (/\b(hr|team|office|admin|department|dept|recruiting|talent|housing|program|admissions|staff)\b/i.test(from)) {
    return from;
  }
  // If it's a single word or looks like a company name (all caps, ends in Inc/LLC/Corp), use full name
  const parts = from.split(' ');
  if (parts.length === 1) return from;
  if (/^[A-Z\s]+$/.test(from) || /\b(inc|llc|corp|ltd|co)\b/i.test(lower)) return from;
  // Otherwise use first name
  return parts[0];
}

/** Contact-type-specific messaging */
function getTypeMessaging(contactType: string) {
  switch (contactType) {
    case 'employer':
    case 'benefits-platform':
      return {
        interestedHook: `SweetLease provides a complimentary housing placement service for relocating employees — saving them $100–$300 per month on rent with zero cost to your organization.`,
        interestedCta: `I would welcome the opportunity to schedule a brief 30-minute call to discuss how SweetLease can support your relocating workforce and reduce relocation friction.`,
        interestedOnboarding: `Integration is straightforward — we handle the entire housing search, vetting, and placement process so your HR team can stay focused on what matters.`,
        questionHook: `Employers partnering with SweetLease offer their relocating employees a fully managed housing placement service at no cost — with average rent savings of $100–$300 per month.`,
        questionBullets: [
          'Completely free for your organization — zero fees, zero overhead',
          'Employees save $100–$300/month on rent vs. searching independently',
          'Pre-vetted, quality housing options matched to employee needs',
          'We handle the full search and placement process end-to-end',
          'Quick setup — we can begin placing employees within days',
        ],
        objectionHook: `SweetLease is entirely free for employers. We handle the housing search and placement for relocating employees at zero cost to your organization, saving them an average of $100–$300 per month in rent. Many companies start with a single department as a pilot — no long-term commitment required.`,
        notInterestedSeed: `For reference, we currently help employers reduce relocation friction with a complimentary housing placement service that saves relocating employees $100–$300 per month. Should your needs change in the future, we would be glad to help.`,
      };
    case 'university':
    case 'residency':
    case 'graduate-housing':
      return {
        interestedHook: `SweetLease provides a free housing resource for incoming students and residents — connecting them with pre-screened landlords offering furnished and unfurnished options at rates significantly below market average.`,
        interestedCta: `I would welcome the opportunity to schedule a brief 30-minute call to discuss how SweetLease can serve as a housing resource for your program.`,
        interestedOnboarding: `Setup is simple — we can have a branded housing portal operational within days of partnership approval, at no cost to your institution.`,
        questionHook: `Universities and residency programs partnering with SweetLease give their incoming students and residents access to a curated, fully managed housing resource — completely free of charge — with rental rates well below what they would find independently.`,
        questionBullets: [
          'Completely free for your institution and your students/residents',
          'Curated housing near campus and clinical sites — furnished and unfurnished options',
          'We negotiate lease terms on behalf of residents, securing rates below market average',
          'Full end-to-end service: search, vetting, negotiation, and placement',
          'Reduces housing-related stress and attrition for incoming cohorts',
          'Minimal administrative effort — branded portal operational within days',
        ],
        objectionHook: `SweetLease is entirely free for institutions. We handle the search, vetting, and lease negotiation for incoming students and residents — securing rates below market average with zero cost and minimal administrative effort from your program. Many institutions start with a single incoming cohort as a pilot — no commitment required.`,
        notInterestedSeed: `For reference, we currently serve as a free housing resource for universities and residency programs, negotiating below-market rates and handling the full placement process for incoming students and residents. Should your needs change in the future, we would be glad to help.`,
      };
    default: // landlord
      return {
        interestedHook: `Our landlord partners are currently filling vacancies 3x faster than the market average, with pre-screened, employer-backed tenants — and at a commission 25% below the industry standard.`,
        interestedCta: `I would welcome the opportunity to schedule a brief 30-minute call to walk you through the platform and discuss how we can put these results to work for your portfolio.`,
        interestedOnboarding: `Our onboarding is quick — we integrate your existing listings at no additional cost and have you up and running in days.`,
        questionHook: `Landlords on our platform are seeing vacancies filled in an average of 14 days — compared to 45 days through traditional channels — with tenants who come pre-screened and backed by their employers.`,
        questionBullets: [
          'You have final say on pricing and tenant approval',
          'Our commission is 25% below the industry standard',
          'All tenants are pre-screened with employer-backed guarantees',
          'Average placement timeline: 14 days, compared to 45 days on traditional platforms',
          'Quick onboarding — we integrate your existing listings at no additional cost',
        ],
        objectionHook: `Landlords using SweetLease are filling vacancies in 14 days on average, with zero upfront cost and a commission 25% below the industry standard. Many started with just one or two units as a pilot — no long-term commitment required.`,
        notInterestedSeed: `For reference, we are currently helping landlords fill vacancies 3x faster with employer-backed tenants at a commission 25% below the industry standard. Should your circumstances change in the future, we would be glad to help.`,
      };
  }
}

function buildTemplateReply(email: OriginalEmail, slots: CalendlySlot[]): { subject: string; body: string; paragraphs: string[] } {
  const firstName = getGreetingName(email.from);
  const subject = `Re: ${email.subject.replace(/^Re:\s*/i, '')}`;
  const contactType = email.contactType || 'landlord';
  const msg = getTypeMessaging(contactType);

  switch (email.classification) {
    case 'interested': {
      const slotLines = slots.length > 0
        ? slots.map(s => `- ${s.label}: ${s.scheduling_url}`).join('\n') + `\n\nAlternatively, you can view all available times here: ${CALENDLY_SCHEDULING_URL}`
        : `You can select a convenient time here: ${CALENDLY_SCHEDULING_URL}`;
      const body = `Dear ${firstName},\n\nThank you for your interest in SweetLease. ${msg.interestedHook}\n\n${msg.interestedCta}\n\n${msg.interestedOnboarding}\n\nBelow are several available times for a conversation:\n${slotLines}\n\nI have also included a partnership overview below for your reference.\n\nBest regards,`;
      const paragraphs = [
        `Dear ${firstName},`,
        `Thank you for your interest in SweetLease. ${msg.interestedHook}`,
        msg.interestedCta,
        msg.interestedOnboarding,
        `Below are several available times for a conversation:`,
      ];
      return { subject, body, paragraphs };
    }
    case 'question': {
      const paragraphs = [
        `Dear ${firstName},`,
        `Thank you for your inquiry. ${msg.questionHook}`,
        `Here is a quick overview of how SweetLease works:`,
        msg.questionBullets.map(b => `&#8226; ${b}`).join('<br style="margin-bottom:6px;">'),
        `I have included a detailed overview document below for your reference. I would also be glad to walk you through our platform and discuss relevant case studies at your convenience.`,
      ];
      const body = `Dear ${firstName},\n\nThank you for your inquiry. ${msg.questionHook}\n\nHere is a quick overview of how SweetLease works:\n\n${msg.questionBullets.map(b => `- ${b}`).join('\n')}\n\nI have included a detailed overview document below for your reference. I would also be glad to walk you through our platform and discuss relevant case studies at your convenience.\n\nBest regards,`;
      return { subject, body, paragraphs };
    }
    case 'objection': {
      const paragraphs = [
        `Dear ${firstName},`,
        `I appreciate you taking the time to respond, and I completely understand. Timing is an important factor in these decisions.`,
        `That said, I wanted to share one data point that our partners have found compelling: ${msg.objectionHook}`,
        `I will plan to follow up in a few months. In the meantime, I have included an overview document below should you wish to learn more at your own pace.`,
      ];
      const body = paragraphs.join('\n\n') + '\n\nBest regards,';
      return { subject, body, paragraphs };
    }
    case 'not_interested': {
      const paragraphs = [
        `Dear ${firstName},`,
        `Thank you for letting me know. I have removed you from our outreach list, and you will not receive further communications from us.`,
        msg.notInterestedSeed,
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
    const systemPrompt = await getReplySystemPrompt(originalEmail.contactType);
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
