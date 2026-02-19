import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { fetchEmails, classifyWithAI, Email } from '@/lib/inbox-fetcher';
import { generateReplyWithAI, REPLY_TEMPLATES, OriginalEmail } from '@/lib/reply-generator';

// Status rank for "only upgrade, never downgrade" logic
const STATUS_RANK: Record<string, number> = {
  new: 0,
  contacted: 1,
  replied: 2,
  qualified: 3,
  disqualified: 4,
};

// Classification → contact status mapping
const CLASSIFICATION_TO_STATUS: Record<string, string> = {
  interested: 'qualified',
  question: 'replied',
  objection: 'replied',
  not_interested: 'disqualified',
};

// Classification → deal stage/probability/next_action
const CLASSIFICATION_TO_DEAL: Record<string, { stage: string; probability: number; next_action: string }> = {
  interested: { stage: 'qualified', probability: 40, next_action: 'Schedule intro call within 24 hours' },
  question: { stage: 'contacted', probability: 25, next_action: 'Answer questions, provide value' },
  objection: { stage: 'contacted', probability: 15, next_action: 'Handle objection, follow up in 2-3 months' },
  not_interested: { stage: 'closed', probability: 0, next_action: 'Removed from outreach' },
};

// Default deal values by contact type
const DEFAULT_DEAL_VALUE: Record<string, number> = {
  landlord: 5000,
  employer: 25000,
  university: 10000,
  residency: 8000,
  'benefits-platform': 25000,
  'graduate-housing': 10000,
};

// Reply delay by classification (milliseconds)
const REPLY_DELAY: Record<string, number> = {
  interested: 15 * 60 * 1000,       // 15 min
  question: 30 * 60 * 1000,         // 30 min
  objection: 2 * 60 * 60 * 1000,    // 2 hours
  not_interested: 1 * 60 * 60 * 1000, // 1 hour
};

function validateCronAuth(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ') && authHeader.slice(7) === cronSecret) {
    return true;
  }

  const { searchParams } = new URL(request.url);
  return searchParams.get('secret') === cronSecret;
}

export async function GET(request: NextRequest) {
  if (!validateCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Fetch emails from IMAP
    let emails: Email[];
    try {
      emails = await fetchEmails('INBOX', 50);
      emails = await classifyWithAI(emails);
    } catch (fetchErr) {
      console.error('Failed to fetch emails from IMAP:', fetchErr);
      return NextResponse.json({ error: 'IMAP fetch failed', details: String(fetchErr) }, { status: 500 });
    }

    let processed = 0;
    let skipped = 0;
    let matched = 0;
    let dealsCreated = 0;
    let dealsUpdated = 0;
    let repliesScheduled = 0;

    for (const email of emails) {
      try {
        // 2. Dedup — check if already processed in inbox_cache
        const cacheKey = `${email.fromEmail}:${email.subject}:${email.date}`;
        const existing = await query(
          `SELECT id, processed FROM inbox_cache WHERE id = $1`,
          [cacheKey]
        );

        if (existing.rows.length > 0 && existing.rows[0].processed === 1) {
          skipped++;
          continue;
        }

        // 3. Upsert into inbox_cache
        await query(
          `INSERT INTO inbox_cache (id, from_name, from_email, subject, preview, body, date, is_read, is_starred, classification, priority, processed)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0)
           ON CONFLICT (id) DO UPDATE SET classification = $10, priority = $11`,
          [cacheKey, email.from, email.fromEmail, email.subject, email.preview, email.body, email.date,
           email.isRead ? 1 : 0, email.isStarred ? 1 : 0, email.classification, email.priority]
        );

        // 4. Match contact
        const contactResult = await query(
          `SELECT * FROM contacts WHERE LOWER(email) = LOWER($1) LIMIT 1`,
          [email.fromEmail]
        );

        if (contactResult.rows.length === 0) {
          // No contact match — log and continue
          await logResponse(email, null, null, null, 'no_contact_match');
          await markProcessed(cacheKey);
          processed++;
          continue;
        }

        const contact = contactResult.rows[0];
        matched++;

        // 5. Skip spam/system — log but no action
        if (email.classification === 'spam' || email.classification === 'system') {
          await logResponse(email, contact.id, null, null, `skipped_${email.classification}`);
          await markProcessed(cacheKey);
          processed++;
          continue;
        }

        // 6. Update contact status (only upgrade, never downgrade)
        const newStatus = CLASSIFICATION_TO_STATUS[email.classification];
        if (newStatus) {
          const currentRank = STATUS_RANK[contact.status] ?? 0;
          const newRank = STATUS_RANK[newStatus] ?? 0;
          if (newRank > currentRank) {
            await query(
              `UPDATE contacts SET status = $1, updated_at = NOW() WHERE id = $2`,
              [newStatus, contact.id]
            );
          }
        }

        // 7. Find or create pipeline deal
        const dealConfig = CLASSIFICATION_TO_DEAL[email.classification];
        let dealId: number;

        const existingDeal = await query(
          `SELECT * FROM pipeline_deals WHERE contact_id = $1 LIMIT 1`,
          [contact.id]
        );

        if (existingDeal.rows.length > 0) {
          // Update existing deal
          dealId = existingDeal.rows[0].id;
          await query(
            `UPDATE pipeline_deals SET stage = $1, probability = $2, next_action = $3, updated_at = NOW() WHERE id = $4`,
            [dealConfig.stage, dealConfig.probability, dealConfig.next_action, dealId]
          );

          await query(
            `INSERT INTO activity_log (deal_id, activity_type, description, metadata)
             VALUES ($1, $2, $3, $4)`,
            [dealId, 'email_response', `${email.classification} response from ${email.from}: ${email.subject}`,
             JSON.stringify({ classification: email.classification, from: email.fromEmail })]
          );

          dealsUpdated++;
        } else {
          // Create new deal
          const contactType = contact.contact_type || 'landlord';
          const dealType = contactType === 'benefits-platform' || contactType === 'graduate-housing'
            ? contactType
            : (['landlord', 'employer', 'university', 'residency'].includes(contactType) ? contactType : 'landlord');
          const dealValue = DEFAULT_DEAL_VALUE[contactType] || 5000;

          const newDeal = await query(
            `INSERT INTO pipeline_deals (name, company, contact_id, type, stage, value, probability, next_action)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id`,
            [
              `${contact.name} - ${contact.org_name || 'Inbound'}`,
              contact.org_name || null,
              contact.id,
              dealType,
              dealConfig.stage,
              dealValue,
              dealConfig.probability,
              dealConfig.next_action,
            ]
          );

          dealId = newDeal.rows[0].id;

          await query(
            `INSERT INTO activity_log (deal_id, activity_type, description, metadata)
             VALUES ($1, $2, $3, $4)`,
            [dealId, 'deal_created', `Deal auto-created from ${email.classification} response`,
             JSON.stringify({ classification: email.classification, from: email.fromEmail })]
          );

          dealsCreated++;
        }

        // 8. Generate + schedule follow-up reply
        let replyScheduledId: number | null = null;
        const delayMs = REPLY_DELAY[email.classification];

        if (delayMs) {
          // Dedup: skip if pending reply already exists for this email within 24h
          const pendingReply = await query(
            `SELECT id FROM scheduled_emails
             WHERE to_email = $1 AND status = 'pending'
             AND created_at > NOW() - INTERVAL '24 hours'
             LIMIT 1`,
            [email.fromEmail]
          );

          if (pendingReply.rows.length === 0) {
            const originalEmail: OriginalEmail = {
              from: email.from,
              fromEmail: email.fromEmail,
              subject: email.subject,
              body: email.body,
              classification: email.classification,
            };

            // Try AI reply first, fall back to template
            let replySubject: string;
            let replyBody: string;

            const aiReply = await generateReplyWithAI(originalEmail);
            if (aiReply) {
              replySubject = aiReply.subject;
              replyBody = aiReply.body;
            } else {
              const template = REPLY_TEMPLATES[email.classification];
              const firstName = email.from.split(' ')[0];
              replySubject = template.subject(email.subject.replace(/^Re:\s*/i, ''));
              replyBody = template.body(firstName);
            }

            const scheduledFor = new Date(Date.now() + delayMs).toISOString();
            const scheduleResult = await query(
              `INSERT INTO scheduled_emails (contact_id, to_email, subject, body, lead_type, scheduled_for)
               VALUES ($1, $2, $3, $4, $5, $6)
               RETURNING id`,
              [contact.id, email.fromEmail, replySubject, replyBody, contact.contact_type || 'landlord', scheduledFor]
            );

            replyScheduledId = scheduleResult.rows[0].id;
            repliesScheduled++;
          }
        }

        // 9. Log to response_log
        await logResponse(email, contact.id, dealId, replyScheduledId,
          `${email.classification}_processed`);

        // 10. Mark inbox_cache as processed
        await markProcessed(cacheKey);
        processed++;
      } catch (emailErr) {
        console.error(`Error processing email from ${email.fromEmail}:`, emailErr);
      }
    }

    return NextResponse.json({
      total: emails.length,
      processed,
      skipped,
      matched,
      deals_created: dealsCreated,
      deals_updated: dealsUpdated,
      replies_scheduled: repliesScheduled,
    });
  } catch (error: any) {
    console.error('Cron process-inbox error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process inbox' },
      { status: 500 }
    );
  }
}

async function logResponse(
  email: Email,
  contactId: number | null,
  dealId: number | null,
  replyScheduledId: number | null,
  actionTaken: string,
) {
  await query(
    `INSERT INTO response_log (from_email, from_name, subject, body, classification, priority, contact_id, deal_id, action_taken, reply_scheduled_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [email.fromEmail, email.from, email.subject, email.body, email.classification, email.priority,
     contactId, dealId, actionTaken, replyScheduledId]
  );
}

async function markProcessed(cacheKey: string) {
  await query(
    `UPDATE inbox_cache SET processed = 1 WHERE id = $1`,
    [cacheKey]
  );
}
