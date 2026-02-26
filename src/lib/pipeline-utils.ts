import { query } from '@/lib/db';

// ─── Shared constants ────────────────────────────────────────────────────

export const STATUS_RANK: Record<string, number> = {
  new: 0,
  contacted: 1,
  replied: 2,
  qualified: 3,
  disqualified: 4,
};

export const OUTCOME_TO_STATUS: Record<string, string> = {
  interested: 'qualified',
  needs_followup: 'qualified',
  objection: 'replied',
  not_interested: 'disqualified',
};

export const OUTCOME_TO_DEAL: Record<string, { stage: string; probability: number; next_action: string }> = {
  interested: { stage: 'qualified', probability: 50, next_action: 'Send proposal within 24 hours' },
  needs_followup: { stage: 'qualified', probability: 35, next_action: 'Follow up with additional information' },
  objection: { stage: 'contacted', probability: 15, next_action: 'Address objections, follow up in 1-2 weeks' },
  not_interested: { stage: 'closed', probability: 0, next_action: 'Removed from active pipeline' },
  no_show: { stage: 'contacted', probability: 10, next_action: 'Reschedule meeting' },
  technical_issue: { stage: 'contacted', probability: 20, next_action: 'Reschedule meeting' },
};

export const DEFAULT_DEAL_VALUE: Record<string, number> = {
  landlord: 5000,
  employer: 25000,
  university: 10000,
  residency: 8000,
  'benefits-platform': 25000,
  'graduate-housing': 10000,
};

const VALID_DEAL_TYPES = ['landlord', 'employer', 'university', 'residency', 'benefits-platform', 'graduate-housing'];

// ─── Upgrade contact status (only upgrade, never downgrade) ──────────────

export async function upgradeContactStatus(contactId: number, newStatus: string): Promise<void> {
  const contactResult = await query(`SELECT status FROM contacts WHERE id = $1`, [contactId]);
  if (contactResult.rows.length === 0) return;

  const currentRank = STATUS_RANK[contactResult.rows[0].status] ?? 0;
  const newRank = STATUS_RANK[newStatus] ?? 0;

  if (newRank > currentRank) {
    await query(
      `UPDATE contacts SET status = $1, updated_at = NOW() WHERE id = $2`,
      [newStatus, contactId]
    );
  }
}

// ─── Stop active email sequences for a contact ──────────────────────────

export async function stopActiveSequences(contactId: number): Promise<void> {
  await query(
    `UPDATE contact_sequences SET status = 'stopped', updated_at = NOW()
     WHERE contact_id = $1 AND status = 'active'`,
    [contactId]
  ).catch(() => {});
}

// ─── Upsert pipeline deal ────────────────────────────────────────────────

export async function upsertPipelineDeal(
  contactId: number,
  contactType: string,
  outcome: string,
  name: string,
  company: string | null,
): Promise<number> {
  const dealConfig = OUTCOME_TO_DEAL[outcome];
  if (!dealConfig) {
    throw new Error(`Unknown outcome: ${outcome}`);
  }

  const existingDeal = await query(
    `SELECT * FROM pipeline_deals WHERE contact_id = $1 LIMIT 1`,
    [contactId]
  );

  if (existingDeal.rows.length > 0) {
    const dealId = existingDeal.rows[0].id;
    await query(
      `UPDATE pipeline_deals SET stage = $1, probability = $2, next_action = $3, updated_at = NOW() WHERE id = $4`,
      [dealConfig.stage, dealConfig.probability, dealConfig.next_action, dealId]
    );
    return dealId;
  }

  const dealType = VALID_DEAL_TYPES.includes(contactType) ? contactType : 'landlord';
  const dealValue = DEFAULT_DEAL_VALUE[contactType] || 5000;

  const newDeal = await query(
    `INSERT INTO pipeline_deals (name, company, contact_id, type, stage, value, probability, next_action)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [name, company, contactId, dealType, dealConfig.stage, dealValue, dealConfig.probability, dealConfig.next_action]
  );

  return newDeal.rows[0].id;
}

// ─── Schedule a follow-up email ──────────────────────────────────────────

export async function scheduleFollowUpEmail(
  toEmail: string,
  contactId: number | null,
  contactType: string,
  subject: string,
  body: string,
  htmlBody: string,
  delayMs: number = 30 * 60 * 1000,
): Promise<void> {
  // Dedup: skip if pending follow-up already exists within 24h
  const pending = await query(
    `SELECT id FROM scheduled_emails
     WHERE to_email = $1 AND status = 'pending'
     AND created_at > NOW() - INTERVAL '24 hours'
     LIMIT 1`,
    [toEmail]
  );
  if (pending.rows.length > 0) return;

  const scheduledFor = new Date(Date.now() + delayMs).toISOString();

  await query(
    `INSERT INTO scheduled_emails (contact_id, to_email, subject, body, html_body, lead_type, scheduled_for)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [contactId, toEmail, subject, body, htmlBody, contactType, scheduledFor]
  );
}

// ─── Get all stakeholders linked to a deal ──────────────────────────────

export async function getDealStakeholders(dealId: number): Promise<any[]> {
  const result = await query(
    `SELECT * FROM contacts WHERE deal_id = $1 ORDER BY referred_by ASC NULLS FIRST`,
    [dealId]
  );
  return result.rows;
}
