import { NextRequest, NextResponse } from 'next/server';
import { OriginalEmail, generateReply, getSuggestedAction } from '@/lib/reply-generator';

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

    const { classification } = originalEmail;

    if (classification === 'spam' || classification === 'system') {
      return NextResponse.json({ error: 'No reply needed for this type of email', classification }, { status: 400 });
    }

    const result = await generateReply(originalEmail);
    if (!result) {
      return NextResponse.json({ error: 'Failed to generate reply' }, { status: 500 });
    }

    return NextResponse.json({
      to: originalEmail.fromEmail,
      subject: result.subject,
      body: result.body,
      classification,
      source: result.source,
      suggestedAction: getSuggestedAction(classification),
    });
  } catch (error) {
    console.error('Error generating reply:', error);
    return NextResponse.json({ error: 'Failed to generate reply' }, { status: 500 });
  }
}
