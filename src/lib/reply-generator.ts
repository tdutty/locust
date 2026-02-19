import Anthropic from '@anthropic-ai/sdk';

export interface OriginalEmail {
  from: string;
  fromEmail: string;
  subject: string;
  body: string;
  classification: 'interested' | 'objection' | 'not_interested' | 'question' | 'spam' | 'system';
}

const CALENDLY_EVENT_TYPE = 'https://api.calendly.com/event_types/9855ae1b-631d-48c4-8089-78956bd85b7d';
const CALENDLY_SCHEDULING_URL = 'https://calendly.com/terrellgilb5/30min';

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
      // Pick slot closest to target hour for variety across the day
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

/** Format slots for display in email body */
function formatSlotsText(slots: CalendlySlot[]): string {
  if (slots.length === 0) {
    return `Grab a time that works best: ${CALENDLY_SCHEDULING_URL}`;
  }
  const lines = slots.map(s => `- ${s.label}: ${s.scheduling_url}`);
  lines.push(`\nOr pick another time: ${CALENDLY_SCHEDULING_URL}`);
  return lines.join('\n');
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
- Be warm and conversational
- Address their specific questions or concerns
- For interested leads: propose a call using ONLY these real available times from Calendly:
${slotText}
  Include the direct booking link for each time slot so they can click to book instantly.
  Also include the general Calendly link: ${CALENDLY_SCHEDULING_URL}
- For objections: acknowledge, provide value, suggest future follow-up
- For questions: answer directly with specific details
- For not_interested: graciously remove them, leave door open
- Keep replies under 150 words
- Sign off as Terrell Gilbert, SweetLease`;
}

export const REPLY_TEMPLATES: Record<string, { subject: (original: string) => string; body: (name: string, slotsText?: string) => string }> = {
  interested: {
    subject: (original: string) => `Re: ${original}`,
    body: (name: string, slotsText?: string) => {
      return `Hi ${name},

Thank you for your interest in SweetLease! I'd love to schedule a quick 30-minute call to learn more about your portfolio and show you how we're helping landlords like you compete with corporate players.

Here are a few times that work for me:
${slotsText || `Grab a time that works best: ${CALENDLY_SCHEDULING_URL}`}

Looking forward to connecting!

Best,
Terrell Gilbert
SweetLease`;
    },
  },
  question: {
    subject: (original: string) => `Re: ${original}`,
    body: (name: string) => `Hi ${name},

Great question! Here's how SweetLease works:

- You set your rates, we bring qualified tenants
- No listing fees or commissions
- Tenants are pre-screened by their employers
- Average time to fill: 14 days vs 45 days on traditional platforms

I'd be happy to walk you through a few case studies from landlords in your area. Would a quick call this week work?

Best,
Terrell Gilbert
SweetLease`,
  },
  objection: {
    subject: (original: string) => `Re: ${original}`,
    body: (name: string) => `Hi ${name},

Completely understand. Timing is everything.

Many of our landlord partners started with just one or two units to test the waters. No long-term commitment required.

I'll check back in a few months. In the meantime, feel free to reach out if anything changes.

Best,
Terrell Gilbert
SweetLease`,
  },
  not_interested: {
    subject: (original: string) => `Re: ${original}`,
    body: (name: string) => `Hi ${name},

No problem at all. I've removed you from our outreach list.

If your situation ever changes, feel free to reach out anytime.

Best of luck with your properties!

Terrell Gilbert
SweetLease`,
  },
  spam: { subject: () => '', body: () => '' },
  system: { subject: () => '', body: () => '' },
};

export async function generateReplyWithAI(originalEmail: OriginalEmail): Promise<{ subject: string; body: string } | null> {
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

/** Generates reply with Calendly slots pre-fetched (for template fallback) */
export async function generateReply(originalEmail: OriginalEmail): Promise<{ subject: string; body: string; source: string } | null> {
  if (originalEmail.classification === 'spam' || originalEmail.classification === 'system') return null;

  // Try AI first
  const aiReply = await generateReplyWithAI(originalEmail);
  if (aiReply) return { ...aiReply, source: 'ai' };

  // Template fallback — fetch Calendly slots for interested templates
  const template = REPLY_TEMPLATES[originalEmail.classification];
  const firstName = originalEmail.from.split(' ')[0];
  const subject = template.subject(originalEmail.subject.replace(/^Re:\s*/i, ''));

  let body: string;
  if (originalEmail.classification === 'interested') {
    const slots = await fetchCalendlySlots();
    body = template.body(firstName, formatSlotsText(slots));
  } else {
    body = template.body(firstName);
  }

  return { subject, body, source: 'template' };
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
