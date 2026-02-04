import { NextRequest, NextResponse } from 'next/server';

interface GenerateReplyRequest {
  originalEmail: {
    from: string;
    fromEmail: string;
    subject: string;
    body: string;
    classification: 'interested' | 'objection' | 'not_interested' | 'question' | 'spam' | 'system';
  };
}

const REPLY_TEMPLATES = {
  interested: {
    subject: (original: string) => `Re: ${original}`,
    body: (name: string) => `Hi ${name},

Thank you for your interest in SweetLease! I'm glad to hear you're open to exploring how we can help.

I'd love to schedule a quick 15-minute call to learn more about your portfolio and show you how we're helping landlords like you compete with corporate players while filling vacancies faster.

Here are a few times that work for me this week:
- Tuesday at 2:00 PM CT
- Wednesday at 10:00 AM CT
- Thursday at 3:00 PM CT

Or feel free to grab a time that works best for you: https://calendly.com/sweetlease/intro

Looking forward to connecting!

Best,
Terrell Gilbert
SweetLease | Batch Fulfillment for Landlords`,
  },

  question: {
    subject: (original: string) => `Re: ${original}`,
    body: (name: string) => `Hi ${name},

Great question! I'm happy to explain how SweetLease works.

In short, we connect your vacant units with relocating employees from major companies like Tesla, Apple, and Bank of America. These are pre-vetted, W-2 employed tenants who need housing quickly and are willing to pay premium rates.

Here's what makes us different:
- You set your rates, we bring qualified tenants
- No listing fees or commissions
- Tenants are pre-screened by their employers
- Average time to fill: 14 days vs 45 days on traditional platforms

I'd be happy to walk you through a few case studies from landlords in your area. Would a quick call this week work?

Best,
Terrell Gilbert
SweetLease | Batch Fulfillment for Landlords`,
  },

  objection: {
    subject: (original: string) => `Re: ${original}`,
    body: (name: string) => `Hi ${name},

I completely understand. Timing is everything in this business.

If it helps, many of our landlord partners started with just one or two units to test the waters before expanding. There's no long-term commitment required.

I'll check back in a few months to see if your situation has changed. In the meantime, feel free to reach out if you have any questions or if a unit unexpectedly becomes available.

Wishing you continued success with your portfolio!

Best,
Terrell Gilbert
SweetLease | Batch Fulfillment for Landlords`,
  },

  not_interested: {
    subject: (original: string) => `Re: ${original}`,
    body: (name: string) => `Hi ${name},

No problem at all. I've removed you from our outreach list.

If your situation ever changes and you'd like to explore corporate tenant options, feel free to reach out anytime.

Best of luck with your properties!

Terrell Gilbert
SweetLease`,
  },

  spam: {
    subject: () => '',
    body: () => '',
  },

  system: {
    subject: () => '',
    body: () => '',
  },
};

export async function POST(request: NextRequest) {
  try {
    const body: GenerateReplyRequest = await request.json();
    const { originalEmail } = body;

    if (!originalEmail) {
      return NextResponse.json({ error: 'Original email is required' }, { status: 400 });
    }

    const { classification, from, subject } = originalEmail;

    // Don't generate replies for spam or system emails
    if (classification === 'spam' || classification === 'system') {
      return NextResponse.json({
        error: 'No reply needed for this type of email',
        classification,
      }, { status: 400 });
    }

    const template = REPLY_TEMPLATES[classification];
    const firstName = from.split(' ')[0];

    const reply = {
      to: originalEmail.fromEmail,
      subject: template.subject(subject.replace(/^Re:\s*/i, '')),
      body: template.body(firstName),
      classification,
      suggestedAction: getSuggestedAction(classification),
    };

    return NextResponse.json(reply);
  } catch (error) {
    console.error('Error generating reply:', error);
    return NextResponse.json({ error: 'Failed to generate reply' }, { status: 500 });
  }
}

function getSuggestedAction(classification: string): string {
  switch (classification) {
    case 'interested':
      return 'Schedule a call within 24 hours to maintain momentum';
    case 'question':
      return 'Respond within 4 hours with helpful information';
    case 'objection':
      return 'Follow up in 2-3 months with a value-focused message';
    case 'not_interested':
      return 'Remove from active sequences, add to long-term nurture';
    default:
      return 'Review and take appropriate action';
  }
}
