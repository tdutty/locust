import Anthropic from '@anthropic-ai/sdk';

export interface OriginalEmail {
  from: string;
  fromEmail: string;
  subject: string;
  body: string;
  classification: 'interested' | 'objection' | 'not_interested' | 'question' | 'spam' | 'system';
}

/** Returns the next 3 weekday slots (skips weekends) with formatted dates */
function getNextAvailableSlots(): string[] {
  const times = ['2:00 PM', '10:00 AM', '3:00 PM'];
  const slots: string[] = [];
  const now = new Date();
  let day = new Date(now);
  // Start from tomorrow
  day.setDate(day.getDate() + 1);

  while (slots.length < 3) {
    const dow = day.getDay();
    if (dow !== 0 && dow !== 6) { // skip weekends
      const dayName = day.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Chicago' });
      const month = day.toLocaleDateString('en-US', { month: 'long', timeZone: 'America/Chicago' });
      const date = day.getDate();
      slots.push(`${dayName}, ${month} ${date} at ${times[slots.length]} CT`);
    }
    day.setDate(day.getDate() + 1);
  }
  return slots;
}

export function getReplySystemPrompt(): string {
  const slots = getNextAvailableSlots();
  return `You are Locust, the AI Account Executive for SweetLease. You are writing a reply to an incoming email.

SweetLease connects independent landlords with relocating corporate employees. Key value props:
- For landlords: Fill vacancies 3x faster, pre-screened tenants with employer-backed guarantees
- For employers: $99.99 one-time employee fee, $100-300/month rent savings, zero cost to employer

Today's date is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' })}.

Rules:
- Be warm and conversational
- Address their specific questions or concerns
- For interested leads: propose a call with these available times:
  - ${slots[0]}
  - ${slots[1]}
  - ${slots[2]}
  Also include the Calendly link: https://calendly.com/sweetlease/intro
- For objections: acknowledge, provide value, suggest future follow-up
- For questions: answer directly with specific details
- For not_interested: graciously remove them, leave door open
- Keep replies under 150 words
- Sign off as Terrell Gilbert, SweetLease`;
}

export const REPLY_TEMPLATES: Record<string, { subject: (original: string) => string; body: (name: string) => string }> = {
  interested: {
    subject: (original: string) => `Re: ${original}`,
    body: (name: string) => {
      const slots = getNextAvailableSlots();
      return `Hi ${name},

Thank you for your interest in SweetLease! I'd love to schedule a quick 15-minute call to learn more about your portfolio and show you how we're helping landlords like you compete with corporate players.

Here are a few times that work for me:
- ${slots[0]}
- ${slots[1]}
- ${slots[2]}

Or grab a time that works best: https://calendly.com/sweetlease/intro

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
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: getReplySystemPrompt(),
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
