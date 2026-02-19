import { NextRequest, NextResponse } from 'next/server';
import { OriginalEmail, generateReplyWithAI, getSuggestedAction, REPLY_TEMPLATES } from '@/lib/reply-generator';

interface GenerateReplyRequest {
  originalEmail: OriginalEmail;
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
