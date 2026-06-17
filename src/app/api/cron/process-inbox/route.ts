import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { fetchEmails, classifyWithAI, Email } from '@/lib/inbox-fetcher';
import { generateReply, generateReferralThankYou, generateWarmIntroEmail, classifyContractRequest, generateContractReply, generateDocumentReceivedAck, generateAdminContractNotification, OriginalEmail, ReferralInfo } from '@/lib/reply-generator';
import Anthropic from '@anthropic-ai/sdk';

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
  referral: 'replied',
  contract_request: 'qualified',
  document_received: 'qualified',
  not_interested: 'disqualified',
};

// Classification → deal stage/probability/next_action
const CLASSIFICATION_TO_DEAL: Record<string, { stage: string; probability: number; next_action: string }> = {
  interested: { stage: 'qualified', probability: 40, next_action: 'Schedule intro call within 24 hours' },
  question: { stage: 'contacted', probability: 25, next_action: 'Answer questions, provide value' },
  objection: { stage: 'contacted', probability: 15, next_action: 'Handle objection, follow up in 2-3 months' },
  referral: { stage: 'qualified', probability: 30, next_action: 'Follow up with referred contact' },
  contract_request: { stage: 'contract_sent', probability: 55, next_action: 'Follow up if unsigned after 5 business days' },
  document_received: { stage: 'contract_signed', probability: 80, next_action: 'Review and countersign documents' },
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
  referral: 20 * 60 * 1000,         // 20 min (thank-you to referrer)
  contract_request: 10 * 60 * 1000, // 10 min — deep in funnel, respond fast
  document_received: 5 * 60 * 1000,   // 5 min — acknowledge receipt immediately
  not_interested: 1 * 60 * 60 * 1000, // 1 hour
};

// Detects auto-responders (out-of-office, vacation replies) and delivery
// failures so the inbox bot never replies to a machine. Headers like
// Auto-Submitted / Precedence aren't exposed by the fetcher, so we match on
// subject, sender, and the opening of the body — covers the common cases.
function isAutoResponder(email: Email): boolean {
  const subject = (email.subject || '').toLowerCase();
  const from = (email.fromEmail || '').toLowerCase();
  const body = (email.body || '').slice(0, 600).toLowerCase();

  // Bounce / system senders
  if (
    from.startsWith('mailer-daemon') ||
    from.startsWith('postmaster@') ||
    from.includes('@mailer-daemon')
  ) {
    return true;
  }

  const subjectSignals = [
    'automatic reply',
    'auto-reply',
    'auto reply',
    'autoreply',
    'out of office',
    'out-of-office',
    'ooo:',
    'away from the office',
    'away from my desk',
    'on vacation',
    'on annual leave',
    'on leave',
    'vacation response',
    'autosvar',
    // delivery failures
    'undeliverable',
    'delivery status notification',
    'mail delivery failed',
    'returned mail',
    'delivery has failed',
    'failure notice',
  ];
  if (subjectSignals.some((s) => subject.includes(s))) return true;

  const bodySignals = [
    'i am currently out of',
    'i will be out of the office',
    'i am out of the office',
    'i am away from the office',
    'thank you for your email. i am',
    'i am on leave',
    'i am on annual leave',
    'currently on vacation',
    'limited access to email',
    'will respond upon my return',
    'i will be returning on',
    'this is an automatic reply',
    'this is an automated response',
  ];
  if (bodySignals.some((s) => body.includes(s))) return true;

  return false;
}

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
    let internalSkipped = 0;

    // Addresses whose inbound mail must NEVER trigger an outbound reply.
    // Prevents the founder/team -> contacts table -> AI reply -> founder
    // feedback loop seen with terrellgilb5@gmail.com (Locust contact id=834).
    const isInternalAddress = (addr: string | undefined): boolean => {
      if (!addr) return false;
      const a = addr.toLowerCase();
      return (
        a.endsWith('@sweetlease.io') ||
        (a.startsWith('terrellgilb') && a.endsWith('@gmail.com')) ||
        a.startsWith('rgilbert@') ||
        a.startsWith('robert@')
      );
    };

    for (const email of emails) {
      try {
        // Internal-address guard: skip founder/team mail before any
        // contact match or reply generation runs.
        if (isInternalAddress(email.fromEmail)) {
          internalSkipped++;
          continue;
        }

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

        // 3a. Auto-responder guard: never reply to out-of-office / vacation
        // auto-replies or delivery-failure bounces. Cache it (so the UI shows
        // it) but stop here — no reply, no status change, no deal updates.
        if (isAutoResponder(email)) {
          await logResponse(email, null, null, null, 'skipped_auto_reply');
          await markProcessed(cacheKey);
          skipped++;
          continue;
        }

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

        // 5a. Handle unsubscribe requests
        if (email.subject?.toLowerCase().includes('unsubscribe')) {
          await query(
            `UPDATE contacts SET status = 'disqualified', notes = COALESCE(notes, '') || ' [Unsubscribed]', updated_at = NOW() WHERE id = $1`,
            [contact.id]
          );
          // Stop any active sequence
          await query(
            `UPDATE contact_sequences SET status = 'stopped', updated_at = NOW() WHERE contact_id = $1 AND status = 'active'`,
            [contact.id]
          ).catch(() => {});
          // Cancel any pending emails
          await query(
            `UPDATE scheduled_emails SET status = 'cancelled' WHERE contact_id = $1 AND status = 'pending'`,
            [contact.id]
          ).catch(() => {});
          await logResponse(email, contact.id, null, null, 'unsubscribed');
          await markProcessed(cacheKey);
          processed++;
          continue;
        }

        // 5a-2. Check if this is a tenant-match landlord reply
        if (email.classification === 'interested' || email.classification === 'question') {
          const tmJobResult = await query(
            `SELECT * FROM tenant_match_jobs WHERE $1 = ANY(matched_contact_ids) AND status IN ('outreach_started', 'matched') LIMIT 1`,
            [contact.id]
          );

          if (tmJobResult.rows.length > 0 && email.classification === 'interested') {
            const tmJob = tmJobResult.rows[0];

            // Update job status
            await query(
              `UPDATE tenant_match_jobs SET status = 'landlord_responded', updated_at = NOW() WHERE id = $1`,
              [tmJob.id]
            );

            // Get listing info for this contact
            const listingResult = await query(
              `SELECT * FROM listings WHERE contact_id = $1 LIMIT 1`,
              [contact.id]
            );
            const listing = listingResult.rows[0];

            // Fire webhook to SweetLease
            const sweetleaseUrl = process.env.SWEETLEASE_API_URL;
            const sweetleaseSecret = process.env.SWEETLEASE_WEBHOOK_SECRET;
            if (sweetleaseUrl && sweetleaseSecret && listing) {
              try {
                await fetch(`${sweetleaseUrl}/api/tenant-match/landlord-interested`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'X-Webhook-Secret': sweetleaseSecret,
                  },
                  body: JSON.stringify({
                    matchRequestId: tmJob.sweetlease_match_request_id,
                    landlordName: contact.name,
                    landlordEmail: contact.email,
                    propertyAddress: listing.address,
                    propertyCity: listing.city,
                    propertyState: listing.state,
                    propertyZip: listing.zip_code,
                    propertyPrice: listing.listed_price,
                    propertyBedrooms: listing.bedrooms,
                    propertyBathrooms: listing.bathrooms,
                    propertySqft: listing.sqft,
                    daysOnMarket: listing.days_on_market,
                  }),
                });
              } catch (webhookErr) {
                console.error('Failed to notify SweetLease of landlord interest:', webhookErr);
              }
            }
          }

          // 5a-3. Check if this is a tenant-match-bulk landlord reply
          if (email.classification === 'interested') {
            const bulkSeqResult = await query(
              `SELECT cs.id, cs.contact_type FROM contact_sequences cs
               WHERE cs.contact_id = $1 AND cs.contact_type = 'tenant-match-bulk' AND cs.status = 'active'
               LIMIT 1`,
              [contact.id]
            );

            if (bulkSeqResult.rows.length > 0) {
              // Find the pipeline deal with batch metadata
              const dealResult = await query(
                `SELECT metadata FROM pipeline_deals WHERE contact_id = $1 AND type = 'tenant-match-bulk' LIMIT 1`,
                [contact.id]
              );

              const sweetleaseUrl = process.env.SWEETLEASE_API_URL;
              const sweetleaseSecret = process.env.SWEETLEASE_WEBHOOK_SECRET;

              if (dealResult.rows.length > 0 && sweetleaseUrl && sweetleaseSecret) {
                const meta = typeof dealResult.rows[0].metadata === 'string'
                  ? JSON.parse(dealResult.rows[0].metadata)
                  : dealResult.rows[0].metadata;

                try {
                  await fetch(`${sweetleaseUrl}/api/tenant-match/landlord-interested`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'X-Webhook-Secret': sweetleaseSecret,
                    },
                    body: JSON.stringify({
                      batchId: meta.batchId,
                      landlordName: contact.name,
                      landlordEmail: contact.email,
                      propertyAddress: meta.propertyAddress,
                      propertyCity: meta.city,
                      propertyState: meta.state,
                      propertyPrice: meta.listingPrice,
                      tenantCount: meta.tenantCount,
                      totalAnnualValue: meta.totalAnnualValue,
                      averageBudget: meta.averageBudget,
                      earliestMoveIn: meta.earliestMoveIn,
                      listingId: meta.listingId,
                    }),
                  });
                } catch (webhookErr) {
                  console.error('Failed to notify SweetLease of bulk landlord interest:', webhookErr);
                }
              }
            }
          }
        }

        // 5b. Skip spam/system — log but no action
        if (email.classification === 'spam' || email.classification === 'system') {
          await logResponse(email, contact.id, null, null, `skipped_${email.classification}`);
          await markProcessed(cacheKey);
          processed++;
          continue;
        }

        // 5c. Handle referrals — extract referred person, create contact, send warm intro + thank-you
        if (email.classification === 'referral') {
          const referralInfo = await extractReferralInfo(email.body, contact.name, contact.org_name);

          if (referralInfo && referralInfo.email) {
            // Check if referred contact already exists
            const existingReferred = await query(
              `SELECT id FROM contacts WHERE LOWER(email) = LOWER($1) LIMIT 1`,
              [referralInfo.email]
            );

            let referredContactId: number;

            if (existingReferred.rows.length > 0) {
              referredContactId = existingReferred.rows[0].id;
            } else {
              // Create new contact for the referred person
              const nameParts = referralInfo.name.split(' ');
              const firstName = nameParts[0];
              const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;

              const newContact = await query(
                `INSERT INTO contacts (first_name, last_name, name, title, email, org_name, contact_type, referred_by, status, notes)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'new', $9)
                 RETURNING id`,
                [
                  firstName,
                  lastName,
                  referralInfo.name,
                  referralInfo.title || null,
                  referralInfo.email,
                  contact.org_name || null,
                  contact.contact_type || 'landlord',
                  contact.id,
                  `Referred by ${contact.name}${referralInfo.role ? `. Role: ${referralInfo.role}` : ''}`,
                ]
              );
              referredContactId = newContact.rows[0].id;
            }

            // Find or create pipeline deal for original contact
            let dealId: number;
            const existingDeal = await query(
              `SELECT * FROM pipeline_deals WHERE contact_id = $1 LIMIT 1`,
              [contact.id]
            );

            const dealConfig = CLASSIFICATION_TO_DEAL['referral'];

            if (existingDeal.rows.length > 0) {
              dealId = existingDeal.rows[0].id;
              await query(
                `UPDATE pipeline_deals SET probability = GREATEST(probability, $1), next_action = $2, updated_at = NOW() WHERE id = $3`,
                [dealConfig.probability, dealConfig.next_action, dealId]
              );
              dealsUpdated++;
            } else {
              const contactType = contact.contact_type || 'landlord';
              const validTypes = ['landlord', 'employer', 'university', 'residency', 'benefits-platform', 'graduate-housing'];
              const dealType = validTypes.includes(contactType) ? contactType : 'landlord';
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
              dealsCreated++;
            }

            // Link both contacts to the deal
            await query(`UPDATE contacts SET deal_id = $1 WHERE id = $2`, [dealId, contact.id]);
            await query(`UPDATE contacts SET deal_id = $1 WHERE id = $2`, [dealId, referredContactId]);

            // Log referral activity
            await query(
              `INSERT INTO activity_log (deal_id, activity_type, description, metadata)
               VALUES ($1, $2, $3, $4)`,
              [dealId, 'referral_received',
               `${contact.name} referred ${referralInfo.name} (${referralInfo.email})`,
               JSON.stringify({ referrer_id: contact.id, referred_id: referredContactId, referral_email: referralInfo.email })]
            );

            // Upgrade original contact status to 'replied'
            const currentRank = STATUS_RANK[contact.status] ?? 0;
            const newRank = STATUS_RANK['replied'] ?? 0;
            if (newRank > currentRank) {
              await query(`UPDATE contacts SET status = 'replied', updated_at = NOW() WHERE id = $1`, [contact.id]);
            }

            // Schedule thank-you reply to referrer (20 min)
            const pendingReply = await query(
              `SELECT id FROM scheduled_emails WHERE to_email = $1 AND status = 'pending' AND created_at > NOW() - INTERVAL '24 hours' LIMIT 1`,
              [email.fromEmail]
            );
            if (pendingReply.rows.length === 0) {
              const originalEmailObj: OriginalEmail = {
                from: email.from,
                fromEmail: email.fromEmail,
                subject: email.subject,
                body: email.body,
                classification: email.classification,
                contactType: contact.contact_type || 'landlord',
              };
              const thankYou = await generateReferralThankYou(originalEmailObj, referralInfo);
              if (thankYou) {
                const scheduledFor = new Date(Date.now() + REPLY_DELAY['referral']).toISOString();
                await query(
                  `INSERT INTO scheduled_emails (contact_id, to_email, subject, body, html_body, lead_type, scheduled_for)
                   VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                  [contact.id, email.fromEmail, thankYou.subject, thankYou.body, thankYou.htmlBody, contact.contact_type || 'landlord', scheduledFor]
                );
                repliesScheduled++;
              }
            }

            // Schedule warm intro email to referred person (30 min — after thank-you)
            const warmIntro = await generateWarmIntroEmail(referralInfo, contact.name, contact.contact_type || 'landlord');
            if (warmIntro) {
              const introScheduledFor = new Date(Date.now() + 30 * 60 * 1000).toISOString();
              await query(
                `INSERT INTO scheduled_emails (contact_id, to_email, subject, body, html_body, lead_type, scheduled_for)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [referredContactId, referralInfo.email, warmIntro.subject, warmIntro.body, warmIntro.htmlBody, contact.contact_type || 'landlord', introScheduledFor]
              );
              repliesScheduled++;
            }

            // Log and mark processed
            await logResponse(email, contact.id, dealId, null, 'referral_processed');
            await markProcessed(cacheKey);
            processed++;
            continue;
          }

          // If referral extraction failed (no email found), fall through as 'question'
          (email as any).classification = 'question';
        }

        // 5d. Handle contract/NDA/security document requests
        if (email.classification === 'contract_request') {
          // Sub-classify request type
          const requestType = await classifyContractRequest(email.body);

          // Upgrade contact status to 'qualified'
          const currentRank = STATUS_RANK[contact.status] ?? 0;
          const qualifiedRank = STATUS_RANK['qualified'] ?? 0;
          if (qualifiedRank > currentRank) {
            await query(`UPDATE contacts SET status = 'qualified', updated_at = NOW() WHERE id = $1`, [contact.id]);
          }

          // Stop active email sequences
          await query(
            `UPDATE contact_sequences SET status = 'stopped', updated_at = NOW() WHERE contact_id = $1 AND status = 'active'`,
            [contact.id]
          ).catch(() => {});

          // Find or create pipeline deal → set stage to 'contract_sent'
          const dealConfig = CLASSIFICATION_TO_DEAL['contract_request'];
          let dealId: number;

          const existingDeal = await query(
            `SELECT * FROM pipeline_deals WHERE contact_id = $1 LIMIT 1`,
            [contact.id]
          );

          if (existingDeal.rows.length > 0) {
            dealId = existingDeal.rows[0].id;
            await query(
              `UPDATE pipeline_deals SET stage = $1, probability = GREATEST(probability, $2), next_action = $3, updated_at = NOW() WHERE id = $4`,
              [dealConfig.stage, dealConfig.probability, dealConfig.next_action, dealId]
            );
            dealsUpdated++;
          } else {
            const contactType = contact.contact_type || 'landlord';
            const validTypes = ['landlord', 'employer', 'university', 'residency', 'benefits-platform', 'graduate-housing'];
            const dealType = validTypes.includes(contactType) ? contactType : 'landlord';
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
            dealsCreated++;
          }

          // Generate and schedule contract reply with document links (10 min delay)
          let replyScheduledId: number | null = null;
          const pendingReply = await query(
            `SELECT id FROM scheduled_emails WHERE to_email = $1 AND status = 'pending' AND created_at > NOW() - INTERVAL '24 hours' LIMIT 1`,
            [email.fromEmail]
          );

          if (pendingReply.rows.length === 0) {
            const originalEmailObj: OriginalEmail = {
              from: email.from,
              fromEmail: email.fromEmail,
              subject: email.subject,
              body: email.body,
              classification: email.classification,
              contactType: contact.contact_type || 'landlord',
            };
            const reply = await generateContractReply(originalEmailObj, requestType);
            if (reply) {
              const scheduledFor = new Date(Date.now() + REPLY_DELAY['contract_request']).toISOString();
              const scheduleResult = await query(
                `INSERT INTO scheduled_emails (contact_id, to_email, subject, body, html_body, lead_type, scheduled_for)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 RETURNING id`,
                [contact.id, email.fromEmail, reply.subject, reply.body, reply.htmlBody, contact.contact_type || 'landlord', scheduledFor]
              );
              replyScheduledId = scheduleResult.rows[0].id;
              repliesScheduled++;

              // Log contract_docs_sent to activity_log
              await query(
                `INSERT INTO activity_log (deal_id, activity_type, description, metadata)
                 VALUES ($1, $2, $3, $4)`,
                [dealId, 'contract_docs_sent',
                 `Contract documents sent to ${email.from} (${requestType} request)`,
                 JSON.stringify({ request_type: requestType, docs_included: reply.docsIncluded, from: email.fromEmail })]
              );
            }
          }

          // Log to response_log
          await logResponse(email, contact.id, dealId, replyScheduledId, 'contract_request_processed');
          await markProcessed(cacheKey);
          processed++;
          continue;
        }

        // 5e. Handle signed document returns — advance deal, ack sender, notify admin
        if (email.classification === 'document_received') {
          // Check if this contact has a deal in a contract stage
          const existingDeal = await query(
            `SELECT * FROM pipeline_deals WHERE contact_id = $1 LIMIT 1`,
            [contact.id]
          );

          const dealConfig = CLASSIFICATION_TO_DEAL['document_received'];
          let dealId: number;

          if (existingDeal.rows.length > 0) {
            dealId = existingDeal.rows[0].id;
            await query(
              `UPDATE pipeline_deals SET stage = $1, probability = GREATEST(probability, $2), next_action = $3, updated_at = NOW() WHERE id = $4`,
              [dealConfig.stage, dealConfig.probability, dealConfig.next_action, dealId]
            );
            dealsUpdated++;
          } else {
            // Create deal if none exists
            const contactType = contact.contact_type || 'landlord';
            const validTypes = ['landlord', 'employer', 'university', 'residency', 'benefits-platform', 'graduate-housing'];
            const dealType = validTypes.includes(contactType) ? contactType : 'landlord';
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
            dealsCreated++;
          }

          // Cancel any pending contract follow-up emails for this contact
          await query(
            `UPDATE scheduled_emails SET status = 'cancelled' WHERE contact_id = $1 AND status = 'pending'`,
            [contact.id]
          ).catch(() => {});

          // Log document received activity
          await query(
            `INSERT INTO activity_log (deal_id, activity_type, description, metadata)
             VALUES ($1, $2, $3, $4)`,
            [dealId, 'document_received',
             `Signed documents received from ${email.from} (${email.fromEmail})`,
             JSON.stringify({ from: email.fromEmail, attachments: email.attachmentNames || [], subject: email.subject })]
          );

          // Schedule acknowledgment reply to sender (5 min)
          let replyScheduledId: number | null = null;
          const pendingReply = await query(
            `SELECT id FROM scheduled_emails WHERE to_email = $1 AND status = 'pending' AND created_at > NOW() - INTERVAL '24 hours' LIMIT 1`,
            [email.fromEmail]
          );

          if (pendingReply.rows.length === 0) {
            const originalEmailObj: OriginalEmail = {
              from: email.from,
              fromEmail: email.fromEmail,
              subject: email.subject,
              body: email.body,
              classification: email.classification,
              contactType: contact.contact_type || 'landlord',
            };
            const ack = await generateDocumentReceivedAck(originalEmailObj);
            if (ack) {
              const scheduledFor = new Date(Date.now() + REPLY_DELAY['document_received']).toISOString();
              const scheduleResult = await query(
                `INSERT INTO scheduled_emails (contact_id, to_email, subject, body, html_body, lead_type, scheduled_for)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 RETURNING id`,
                [contact.id, email.fromEmail, ack.subject, ack.body, ack.htmlBody, contact.contact_type || 'landlord', scheduledFor]
              );
              replyScheduledId = scheduleResult.rows[0].id;
              repliesScheduled++;
            }
          }

          // Send notification to admin@sweetlease.io
          const previousStage = existingDeal.rows.length > 0 ? existingDeal.rows[0].stage : 'new';
          const adminNotification = generateAdminContractNotification({
            contactName: contact.name,
            contactEmail: email.fromEmail,
            contactType: contact.contact_type || 'landlord',
            orgName: contact.org_name,
            dealId,
            dealStage: previousStage,
            emailSubject: email.subject,
            attachmentNames: email.attachmentNames || [],
          });

          await query(
            `INSERT INTO scheduled_emails (to_email, subject, body, html_body, lead_type, scheduled_for)
             VALUES ($1, $2, $3, $4, $5, NOW())`,
            ['admin@sweetlease.io', adminNotification.subject, adminNotification.body, adminNotification.htmlBody, 'internal']
          );

          // Log to response_log
          await logResponse(email, contact.id, dealId, replyScheduledId, 'document_received_processed');
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

            // Stop any active follow-up sequence for this contact
            await query(
              `UPDATE contact_sequences SET status = 'stopped', updated_at = NOW()
               WHERE contact_id = $1 AND status = 'active'`,
              [contact.id]
            ).catch(err => console.error('Failed to stop sequence:', err));
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
              contactType: contact.contact_type || 'landlord',
            };

            const reply = await generateReply(originalEmail);
            if (!reply) continue;

            const scheduledFor = new Date(Date.now() + delayMs).toISOString();
            const scheduleResult = await query(
              `INSERT INTO scheduled_emails (contact_id, to_email, subject, body, html_body, lead_type, scheduled_for)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               RETURNING id`,
              [contact.id, email.fromEmail, reply.subject, reply.body, reply.htmlBody, contact.contact_type || 'landlord', scheduledFor]
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
      internal_skipped: internalSkipped,
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

async function extractReferralInfo(emailBody: string, senderName: string, orgName: string | null): Promise<ReferralInfo | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: `Extract the referred person's contact info from this email. The sender (${senderName}${orgName ? ` at ${orgName}` : ''}) is referring us to someone else.

Email body:
${emailBody}

Return JSON: {"name": "Full Name", "email": "email@domain.com or null", "title": "Job Title or null", "role": "Their role description or null"}

If you cannot find a name, return {"name": null}. Set email to null if not found.`
      }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.name) {
        return {
          name: parsed.name,
          email: parsed.email || null,
          title: parsed.title || null,
          role: parsed.role || null,
        };
      }
    }
    return null;
  } catch (err) {
    console.error('Referral extraction failed:', err);
    return null;
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
