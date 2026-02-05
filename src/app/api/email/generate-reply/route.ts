import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

interface GenerateReplyRequest {
  originalEmail: {
    from: string;
    fromEmail: string;
    subject: string;
    body: string;
    classification: 'interested' | 'objection' | 'not_interested' | 'question' | 'spam' | 'system';
  };
}

const REPLY_SYSTEM_PROMPT = `You are Locust, the AI Account Executive for SweetLease. You are writing a reply to an incoming email.

SweetLease connects independent landlords with relocating corporate employees. Key value props:
- For landlords: Fill vacancies 3x faster, pre-screened tenants with employer-backed guarantees
- For employers: $99.99 one-time employee fee, $100-300/month rent savings, zero cost to employer

Rules:
- Be warm and conversational
- Address their specific questions or concerns
- For interested leads: propose a call, link to https://calendly.com/sweetlease/intro
- For objections: acknowledge, provide value, suggest future follow-up
- For questions: answer directly with specific details
- For not_interested: graciously remove them, leave door open
- Keep replies under 150 words
- Sign off as Terrell Gilbert, SweetLease`;

const REPLY_TEMPLATES = {
  interested: {
    subject: (original: string) => `Re: ${original}`,
    body: (name: string) => `Hi ${name},

Thank you for your interest in SweetLease! I'd love to schedule a quick 15-minute call to learn more about your portfolio and show you how we're helping landlords like you compete with corporate players.

Here are a few times that work for me this week:
- Tuesday at 2:00 PM CT
- Wednesday at 10:00 AM CT
- Thursday at 3:00 PM CT

Or grab a time that works best: https://calendly.com/sweetlease/intro

Looking forward to connecting!

Best,
Terrell Gilbert
SweetLease`,
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

async function generateReplyWithAI(originalEmail: GenerateReplyRequest['originalEmail']): Promise<{ subject: string; body: string } | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: REPLY_SYSTEM_PROMPT,
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

function getSuggestedAction(classification: string): string {
  switch (classification) {
    case 'interested': return 'Schedule a call within 24 hours to maintain momentum';
    case 'question': return 'Respond within 4 hours with helpful information';
    case 'objection': return 'Follow up in 2-3 months with a value-focused message';
    case 'not_interested': return 'Remove from active sequences, add to long-term nurture';
    default: return 'Review and take appropriate action';
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateReplyRequest = await request.json();
    const { originalEmail } = body;

    if (!originalEmail) {
      return NextResponse.json({ error: 'Original email is required' }, { status: 400 });
    }

    const { classification, from, subject } = originalEmail;

    if (classification === 'spam' || classification === 'system') {
      return NextResponse.json({ error: 'No reply needed for this type of email', classification }, { status: 400 });
    }

    // Try AI reply first
    const aiResult = await generateReplyWithAI(originalEmail);
    if (aiResult) {
      return NextResponse.json({
        to: originalEmail.fromEmail,
        subject: aiResult.subject,
        body: aiResult.body,
        classification,
        source: 'ai',
        suggestedAction: getSuggestedAction(classification),
      });
    }

    // Fallback to templates
    const template = REPLY_TEMPLATES[classification];
    const firstName = from.split(' ')[0];

    return NextResponse.json({
      to: originalEmail.fromEmail,
      subject: template.subject(subject.replace(/^Re:\s*/i, '')),
      body: template.body(firstName),
      classification,
      source: 'template',
      suggestedAction: getSuggestedAction(classification),
    });
  } catch (error) {
    console.error('Error generating reply:', error);
    return NextResponse.json({ error: 'Failed to generate reply' }, { status: 500 });
  }
}
