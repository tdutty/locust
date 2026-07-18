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
  classification: 'interested' | 'objection' | 'not_interested' | 'question' | 'referral' | 'contract_request' | 'document_received' | 'spam' | 'system';
  priority: 'high' | 'medium' | 'low';
  hasAttachments: boolean;
  attachmentNames: string[];
}

export function getImapConfig() {
  const user = process.env.IMAP_USER || process.env.SMTP_USER;
  const password = process.env.IMAP_PASSWORD || process.env.SMTP_PASSWORD;
  if (!user || !password) {
    throw new Error('IMAP_USER/SMTP_USER and IMAP_PASSWORD/SMTP_PASSWORD environment variables are required');
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

export function classifyEmail(subject: string, body: string, opts?: { hasAttachments?: boolean; attachmentNames?: string[] }): { classification: Email['classification']; priority: Email['priority'] } {
  const lowerSubject = subject.toLowerCase();
  const lowerBody = body.toLowerCase();
  const combined = `${lowerSubject} ${lowerBody}`;

  // Check for signed document returns (attachments + signing language)
  const hasDocAttachment = opts?.hasAttachments && opts.attachmentNames?.some(name => {
    const lower = name.toLowerCase();
    return lower.endsWith('.pdf') || lower.endsWith('.docx') || lower.endsWith('.doc');
  });
  const signingKeywords = combined.includes('signed') || combined.includes('executed') ||
      combined.includes('attached') || combined.includes('here is the') ||
      combined.includes('here are the') || combined.includes('returning the') ||
      combined.includes('completed nda') || combined.includes('completed contract') ||
      combined.includes('fully executed') || combined.includes('countersigned');
  if (hasDocAttachment && signingKeywords) {
    return { classification: 'document_received', priority: 'high' };
  }

  // Check for contract/NDA/security document requests (before interested — higher-signal action)
  if (combined.includes('nda') || combined.includes('non-disclosure') || combined.includes('contract') ||
      combined.includes('msa') || combined.includes('master service agreement') ||
      combined.includes('security questionnaire') || combined.includes('soc 2') || combined.includes('soc2') ||
      combined.includes('vendor assessment') || combined.includes('data processing agreement') ||
      combined.includes('legal team') || combined.includes('legal review') ||
      combined.includes('procurement requires') || combined.includes('procurement process') ||
      combined.includes('terms of service') || combined.includes('send us your terms') ||
      combined.includes('send over a contract') || combined.includes('listing agreement')) {
    return { classification: 'contract_request', priority: 'high' };
  }

  // Check for interested signals
  if (combined.includes('interested') || combined.includes('tell me more') || combined.includes('schedule') ||
      combined.includes('meeting') || combined.includes('call me') || combined.includes('sounds good')) {
    return { classification: 'interested', priority: 'high' };
  }

  // Check for referral signals (someone pointing us to another decision-maker)
  if (combined.includes('talk to') || combined.includes('reach out to') ||
      combined.includes('contact my') || combined.includes('not the right person') ||
      combined.includes('cc my') || combined.includes('put you in touch') ||
      combined.includes('handles that') || combined.includes('decision maker') ||
      combined.includes('refer you') || combined.includes('forward this to')) {
    return { classification: 'referral', priority: 'high' };
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

                // Extract attachment info
                const attachments = parsed.attachments || [];
                const hasAttachments = attachments.length > 0;
                const attachmentNames = attachments.map(a => a.filename || 'unnamed').filter(Boolean);

                const { classification, priority } = classifyEmail(parsed.subject || '', body, { hasAttachments, attachmentNames });

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
                  hasAttachments,
                  attachmentNames,
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
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Classify these sales response emails. For each, return classification (interested/objection/not_interested/question/referral/contract_request/document_received/spam/system) and priority (high/medium/low).

A "referral" classification means the sender is directing us to another person — e.g. "talk to Sarah", "reach out to our HR director", "CC my manager", "I'm not the right person, contact..."

A "contract_request" classification means the sender is requesting legal/contract documents — e.g. "we need an NDA", "send over a contract", "our legal team needs to review", "do you have an MSA?", "security questionnaire required", "procurement process requires...", "send us your terms"

A "document_received" classification means the sender is returning signed/executed documents — e.g. "here is the signed NDA", "attached is the executed contract", "returning the completed agreement". Usually has PDF/DOCX attachments.

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
