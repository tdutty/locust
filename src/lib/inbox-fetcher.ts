import Imap from 'imap';
import { simpleParser } from 'mailparser';
import Anthropic from '@anthropic-ai/sdk';

export interface Email {
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

export function getImapConfig() {
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

export function classifyEmail(subject: string, body: string): { classification: Email['classification']; priority: Email['priority'] } {
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

export async function fetchEmails(folder: string = 'INBOX', limit: number = 50): Promise<Email[]> {
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

export async function classifyWithAI(emails: Email[]): Promise<Email[]> {
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
