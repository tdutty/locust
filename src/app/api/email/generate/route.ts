import { NextRequest, NextResponse } from 'next/server';
import {
  generateWithAI,
  getSequenceForType,
  LeadInfo,
} from '@/lib/email-templates';

interface GenerateEmailRequest {
  leadType: 'landlord' | 'employer' | 'university' | 'residency' | 'benefits-platform' | 'graduate-housing';
  lead: LeadInfo;
  emailNumber: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateEmailRequest = await request.json();
    const { leadType, lead, emailNumber } = body;

    if (!leadType || !lead || !emailNumber) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Try AI generation first
    const aiResult = await generateWithAI(lead, leadType, emailNumber);
    if (aiResult) {
      return NextResponse.json({
        to: lead.email,
        subject: aiResult.subject,
        body: aiResult.body,
        emailNumber,
        leadType,
        source: 'ai',
        lead: { name: lead.name, email: lead.email },
      });
    }

    // Fallback to templates
    const sequences = getSequenceForType(leadType);
    const index = Math.min(emailNumber - 1, sequences.length - 1);
    const template = sequences[index];

    let subject = template.subject
      .replace(/\{\{company\}\}/g, lead.company || lead.name)
      .replace(/\{\{university\}\}/g, lead.university || lead.name)
      .replace(/\{\{orgName\}\}/g, lead.orgName || lead.company || lead.name)
      .replace(/\{\{city\}\}/g, lead.city || 'your area')
      .replace(/\$\{city\}/g, lead.city || 'your area')
      .replace(/\$\{company\}/g, lead.company || 'your company');

    const emailBody = template.body(lead);

    return NextResponse.json({
      to: lead.email,
      subject,
      body: emailBody,
      emailNumber,
      leadType,
      source: 'template',
      lead: { name: lead.name, email: lead.email },
    });
  } catch (error) {
    console.error('Error generating email:', error);
    return NextResponse.json({ error: 'Failed to generate email' }, { status: 500 });
  }
}
