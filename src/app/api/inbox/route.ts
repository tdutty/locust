import { NextRequest, NextResponse } from 'next/server';
import { Email, fetchEmails, classifyWithAI } from '@/lib/inbox-fetcher';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const folder = searchParams.get('folder') || 'INBOX';
    const limit = parseInt(searchParams.get('limit') || '50');

    let emails = await fetchEmails(folder, limit);

    // Post-process with AI classification
    emails = await classifyWithAI(emails);

    return NextResponse.json({
      emails,
      total: emails.length,
      source: 'imap',
    });
  } catch (error) {
    console.error('Error fetching inbox:', error);

    // Return sample data on error
    return NextResponse.json({
      emails: getSampleEmails(),
      total: 8,
      source: 'sample',
    });
  }
}

function getSampleEmails(): Email[] {
  return [
    {
      id: '1',
      from: 'Alexander Phillips',
      fromEmail: 'alex.phillips@gmail.com',
      subject: 'Re: How to compete with corporate landlords',
      preview: 'This is interesting. I have been struggling with vacancy rates lately...',
      body: 'This is interesting. I have been struggling with vacancy rates lately and would love to hear more about how SweetLease can help. Do you have time for a call this week?',
      date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      isRead: false,
      isStarred: true,
      classification: 'interested',
      priority: 'high',
    },
    {
      id: '2',
      from: 'Sarah Johnson',
      fromEmail: 'sjohnson@realestate.net',
      subject: 'Re: Your Houston vacancies are costing you $X/day',
      preview: 'How exactly does this work? What are the fees involved?',
      body: 'How exactly does this work? What are the fees involved? I manage 34 properties and would need to understand the economics better.',
      date: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      isRead: false,
      isStarred: false,
      classification: 'question',
      priority: 'medium',
    },
    {
      id: '3',
      from: 'Robert Chen',
      fromEmail: 'rchen@propertymgmt.com',
      subject: 'Re: We\'re onboarding 5 Austin landlords this month',
      preview: 'Not interested at this time. Please remove me from your list.',
      body: 'Not interested at this time. Please remove me from your list.',
      date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      isRead: true,
      isStarred: false,
      classification: 'not_interested',
      priority: 'low',
    },
    {
      id: '4',
      from: 'Tesla HR',
      fromEmail: 'hr@tesla.com',
      subject: 'Re: Relocation housing solutions for Tesla employees',
      preview: 'We currently use SIRVA for relocations but are always open to hearing about alternatives...',
      body: 'We currently use SIRVA for relocations but are always open to hearing about alternatives. Can you send over some case studies and pricing information?',
      date: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      isRead: false,
      isStarred: true,
      classification: 'interested',
      priority: 'high',
    },
    {
      id: '5',
      from: 'Mail Delivery System',
      fromEmail: 'mailer-daemon@porkbun.com',
      subject: 'Undeliverable: Your Austin vacancies',
      preview: 'This message was created automatically by mail delivery software...',
      body: 'This message was created automatically by mail delivery software. A message that you sent could not be delivered to one or more recipients.',
      date: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      isRead: true,
      isStarred: false,
      classification: 'system',
      priority: 'low',
    },
    {
      id: '6',
      from: 'Jennifer Martinez',
      fromEmail: 'jmartinez@gmail.com',
      subject: 'Re: Should I close your file?',
      preview: 'Sorry for the delay! I was traveling. Yes, I am interested in learning more...',
      body: 'Sorry for the delay! I was traveling. Yes, I am interested in learning more about SweetLease. Can we schedule a call for next Tuesday?',
      date: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      isRead: false,
      isStarred: false,
      classification: 'interested',
      priority: 'high',
    },
    {
      id: '7',
      from: 'David Thompson',
      fromEmail: 'dthompson@txproperties.com',
      subject: 'Re: How to compete with corporate landlords',
      preview: 'We already work with a corporate housing company. Maybe next year.',
      body: 'We already work with a corporate housing company. Maybe next year when our contract is up for renewal.',
      date: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
      isRead: true,
      isStarred: false,
      classification: 'objection',
      priority: 'medium',
    },
    {
      id: '8',
      from: 'Bank of America HR',
      fromEmail: 'hr.relocations@bofa.com',
      subject: 'Re: Employee relocation housing partnership',
      preview: 'Thank you for reaching out. We handle over 1,200 relocations per year...',
      body: 'Thank you for reaching out. We handle over 1,200 relocations per year and are interested in exploring partnerships that could reduce costs for our employees. Please send a formal proposal.',
      date: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      isRead: false,
      isStarred: true,
      classification: 'interested',
      priority: 'high',
    },
  ];
}
