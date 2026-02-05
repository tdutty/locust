import { NextRequest, NextResponse } from 'next/server';
import Imap from 'imap';
import { simpleParser, ParsedMail } from 'mailparser';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';

function getImapConfig() {
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  if (!user || !password) {
    throw new Error('SMTP_USER and SMTP_PASSWORD environment variables are required');
  }
  return {
    user,
    password,
    host: process.env.IMAP_HOST || 'imap.porkbun.com',
    port: parseInt(process.env.IMAP_PORT || '993'),
    tls: true,
    tlsOptions: { rejectUnauthorized: false },
  };
}

interface Email {
  id: string;
  from: string;
  fromEmail: string;
  subject: string;
  preview: string;
  body: string;
  date: string;
  isRead: boolean;
  isStarred: boolean;
  classification: 'interested' | 'objection' | 'not_interested' | 'question' | 'spam' | 'system';
  priority: 'high' | 'medium' | 'low';
}

function classifyEmail(subject: string, body: string): { classification: Email['classification']; priority: Email['priority'] } {
  const lowerSubject = subject.toLowerCase();
  const lowerBody = body.toLowerCase();
  const combined = `${lowerSubject} ${lowerBody}`;

  // Check for interested signals
  if (combined.includes('interested') || combined.includes('tell me more') || combined.includes('schedule') ||
      combined.includes('meeting') || combined.includes('call me') || combined.includes('sounds good')) {
    return { classification: 'interested', priority: 'high' };
  }

  // Check for objections
  if (combined.includes('not right now') || combined.includes('maybe later') || combined.includes('too expensive') ||
      combined.includes('already have') || combined.includes('using another')) {
    return { classification: 'objection', priority: 'medium' };
  }

  // Check for not interested
  if (combined.includes('unsubscribe') || combined.includes('remove me') || combined.includes('stop emailing') ||
      combined.includes('not interested') || combined.includes('no thanks')) {
    return { classification: 'not_interested', priority: 'low' };
  }

  // Check for questions
  if (combined.includes('how does') || combined.includes('what is') || combined.includes('can you explain') ||
      combined.includes('?') || combined.includes('more information')) {
    return { classification: 'question', priority: 'medium' };
  }

  // Check for system emails
  if (lowerSubject.includes('delivery') || lowerSubject.includes('undeliverable') ||
      lowerSubject.includes('auto-reply') || lowerSubject.includes('out of office')) {
    return { classification: 'system', priority: 'low' };
  }

  // Default
  return { classification: 'question', priority: 'medium' };
}

async function fetchEmails(folder: string = 'INBOX', limit: number = 50): Promise<Email[]> {
  return new Promise((resolve, reject) => {
    const imap = new Imap(getImapConfig());
    const emails: Email[] = [];

    imap.once('ready', () => {
      imap.openBox(folder, true, (err, box) => {
        if (err) {
          imap.end();
          reject(err);
          return;
        }

        if (!box.messages.total) {
          imap.end();
          resolve([]);
          return;
        }

        const fetchCount = Math.min(limit, box.messages.total);
        const start = Math.max(1, box.messages.total - fetchCount + 1);
        const fetch = imap.seq.fetch(`${start}:*`, {
          bodies: '',
          struct: true,
        });

        fetch.on('message', (msg, seqno) => {
          msg.on('body', (stream) => {
            let buffer = '';
            stream.on('data', (chunk) => {
              buffer += chunk.toString('utf8');
            });
            stream.once('end', async () => {
              try {
                const parsed = await simpleParser(buffer);
                const fromAddress = Array.isArray(parsed.from?.value)
                  ? parsed.from.value[0]
                  : parsed.from?.value;

                const htmlContent = typeof parsed.html === 'string' ? parsed.html : '';
                const body = parsed.text || htmlContent.replace(/<[^>]*>/g, '') || '';
                const { classification, priority } = classifyEmail(parsed.subject || '', body);

                emails.push({
                  id: seqno.toString(),
                  from: fromAddress?.name || fromAddress?.address || 'Unknown',
                  fromEmail: fromAddress?.address || '',
                  subject: parsed.subject || '(No Subject)',
                  preview: body.substring(0, 150).replace(/\n/g, ' ').trim(),
                  body: body,
                  date: parsed.date?.toISOString() || new Date().toISOString(),
                  isRead: false,
                  isStarred: false,
                  classification,
                  priority,
                });
              } catch (parseErr) {
                console.error('Error parsing email:', parseErr);
              }
            });
          });
        });

        fetch.once('error', (fetchErr) => {
          console.error('Fetch error:', fetchErr);
        });

        fetch.once('end', () => {
          imap.end();
          resolve(emails.reverse()); // Most recent first
        });
      });
    });

    imap.once('error', (err: Error) => {
      console.error('IMAP error:', err);
      reject(err);
    });

    imap.connect();
  });
}

async function classifyWithAI(emails: Email[]): Promise<Email[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || emails.length === 0) return emails;

  try {
    const client = new Anthropic({ apiKey });
    const emailSummaries = emails.slice(0, 20).map((e, i) => `[${i}] From: ${e.from} | Subject: ${e.subject} | Preview: ${e.preview.substring(0, 100)}`).join('\n');

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Classify these sales response emails. For each, return classification (interested/objection/not_interested/question/spam/system) and priority (high/medium/low).

${emailSummaries}

Return JSON array: [{"index": 0, "classification": "...", "priority": "..."}]`
      }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const results = JSON.parse(jsonMatch[0]);
      for (const r of results) {
        if (emails[r.index]) {
          emails[r.index].classification = r.classification;
          emails[r.index].priority = r.priority;
        }
      }
    }
  } catch (err) {
    console.error('AI classification failed, keeping keyword results:', err);
  }
  return emails;
}

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
