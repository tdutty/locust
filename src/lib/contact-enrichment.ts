/**
 * Contact Enrichment Pipeline — cascading strategy to find landlord/agent contacts.
 *
 * Order (cheapest/most reliable first):
 * 1. DB check (free)
 * 2. Zillow scraper (free)
 * 3. Scrapeak property (20 credits ~$0.02)
 * 4. Apollo lookup (1 credit ~$0.01)
 * 5. BatchData skip trace ($0.01-0.02, last resort)
 */

import { query } from '@/lib/db';
import { scrapeZillowContact } from '@/lib/zillow-scraper';
import { lookupByName, lookupByOrganization, parseName } from '@/lib/apollo-contact';
import { skipTrace } from '@/lib/batchdata';

const SCRAPEAK_API_KEY = process.env.SCRAPEAK_API_KEY || '';

export interface EnrichmentRequest {
  sweetleaseListingId?: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  zillowUrl?: string;
  zpid?: string;
}

export interface EnrichmentResult {
  sweetleaseListingId?: string;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerPhone: string | null;
  ownerType: 'individual' | 'corporate' | 'unknown';
  agentName: string | null;
  agentPhone: string | null;
  brokerName: string | null;
  contactSource: string; // 'db' | 'zillow' | 'scrapeak' | 'apollo' | 'batchdata' | 'none'
  confidence: 'high' | 'medium' | 'low' | 'none';
  strategies: StrategyLog[];
}

interface StrategyLog {
  name: string;
  attempted: boolean;
  found: boolean;
  fieldsFound: string[];
  durationMs: number;
  cost: number;
  error?: string;
}

function hasEmail(r: EnrichmentResult): boolean {
  return !!(r.ownerEmail || r.agentPhone);
}

function hasContactableInfo(r: EnrichmentResult): boolean {
  return !!(r.ownerEmail || r.agentPhone || r.ownerPhone);
}

/**
 * Enrich a single listing's contact info using cascading strategies.
 */
export async function enrichContact(req: EnrichmentRequest): Promise<EnrichmentResult> {
  const result: EnrichmentResult = {
    sweetleaseListingId: req.sweetleaseListingId,
    ownerName: null,
    ownerEmail: null,
    ownerPhone: null,
    ownerType: 'unknown',
    agentName: null,
    agentPhone: null,
    brokerName: null,
    contactSource: 'none',
    confidence: 'none',
    strategies: [],
  };

  // ── Strategy 1: DB check ──
  const dbStart = Date.now();
  try {
    const dbResult = await query(
      `SELECT owner_name, owner_email, owner_phone, owner_type, agent_name, agent_phone, broker_name, contact_enriched_at
       FROM listings
       WHERE LOWER(address) = LOWER($1) AND LOWER(city) = LOWER($2) AND LOWER(state) = LOWER($3)
       LIMIT 1`,
      [req.address, req.city, req.state]
    );

    const row = dbResult.rows[0];
    if (row) {
      if (row.owner_email) result.ownerEmail = row.owner_email;
      if (row.owner_name) result.ownerName = row.owner_name;
      if (row.owner_phone) result.ownerPhone = row.owner_phone;
      if (row.owner_type) result.ownerType = row.owner_type;
      if (row.agent_name) result.agentName = row.agent_name;
      if (row.agent_phone) result.agentPhone = row.agent_phone;
      if (row.broker_name) result.brokerName = row.broker_name;

      const found = hasContactableInfo(result);
      result.strategies.push({
        name: 'db', attempted: true, found,
        fieldsFound: Object.entries({ ownerEmail: result.ownerEmail, agentPhone: result.agentPhone, brokerName: result.brokerName })
          .filter(([, v]) => v).map(([k]) => k),
        durationMs: Date.now() - dbStart, cost: 0,
      });

      if (result.ownerEmail) {
        result.contactSource = 'db';
        result.confidence = 'high';
        await logEnrichment(req, result);
        return result;
      }
    } else {
      result.strategies.push({ name: 'db', attempted: true, found: false, fieldsFound: [], durationMs: Date.now() - dbStart, cost: 0 });
    }
  } catch (err: any) {
    result.strategies.push({ name: 'db', attempted: true, found: false, fieldsFound: [], durationMs: Date.now() - dbStart, cost: 0, error: err.message });
  }

  // ── Strategy 2: Zillow scraper ──
  if (req.zillowUrl) {
    const zStart = Date.now();
    try {
      const contact = await scrapeZillowContact(req.zillowUrl);
      const fieldsFound: string[] = [];

      if (contact.agentName && !result.agentName) { result.agentName = contact.agentName; fieldsFound.push('agentName'); }
      if (contact.agentPhone && !result.agentPhone) { result.agentPhone = contact.agentPhone; fieldsFound.push('agentPhone'); }
      if (contact.brokerName && !result.brokerName) { result.brokerName = contact.brokerName; fieldsFound.push('brokerName'); }

      const found = fieldsFound.length > 0;
      result.strategies.push({ name: 'zillow', attempted: true, found, fieldsFound, durationMs: Date.now() - zStart, cost: 0 });

      if (hasContactableInfo(result) && !result.contactSource.includes('zillow')) {
        result.contactSource = 'zillow';
        result.confidence = 'high';
      }
    } catch (err: any) {
      result.strategies.push({ name: 'zillow', attempted: true, found: false, fieldsFound: [], durationMs: Date.now() - zStart, cost: 0, error: err.message });
    }
  } else {
    result.strategies.push({ name: 'zillow', attempted: false, found: false, fieldsFound: [], durationMs: 0, cost: 0, error: 'no zillowUrl' });
  }

  // If we already have an email, stop
  if (result.ownerEmail) {
    await storeAndLog(req, result);
    return result;
  }

  // ── Strategy 3: Scrapeak property ──
  if (SCRAPEAK_API_KEY) {
    const sStart = Date.now();
    try {
      let zpid = req.zpid;

      // Get zpid from address if not provided
      if (!zpid) {
        const zpidResp = await fetch(
          `https://app.scrapeak.com/v1/scrapers/zillow/zpidByAddress?api_key=${SCRAPEAK_API_KEY}&street=${encodeURIComponent(req.address)}&city=${encodeURIComponent(req.city)}&state=${encodeURIComponent(req.state)}&zipcode=${encodeURIComponent(req.zip)}`
        );
        if (zpidResp.ok) {
          const zpidData = await zpidResp.json();
          zpid = zpidData?.data?.[0]?.zpid || zpidData?.zpid || null;
        }
      }

      if (zpid) {
        const propResp = await fetch(
          `https://app.scrapeak.com/v1/scrapers/zillow/property?api_key=${SCRAPEAK_API_KEY}&zpid=${zpid}`
        );
        if (propResp.ok) {
          const propData = await propResp.json();
          const d = propData?.data || {};
          const fieldsFound: string[] = [];

          if (d.attributionInfo?.agentName && !result.agentName) {
            result.agentName = d.attributionInfo.agentName;
            fieldsFound.push('agentName');
          }
          if (d.attributionInfo?.agentPhoneNumber && !result.agentPhone) {
            result.agentPhone = d.attributionInfo.agentPhoneNumber;
            fieldsFound.push('agentPhone');
          }
          if (d.attributionInfo?.brokerName && !result.brokerName) {
            result.brokerName = d.attributionInfo.brokerName;
            fieldsFound.push('brokerName');
          }

          result.strategies.push({
            name: 'scrapeak', attempted: true, found: fieldsFound.length > 0,
            fieldsFound, durationMs: Date.now() - sStart, cost: 0.02,
          });

          if (hasContactableInfo(result) && result.contactSource === 'none') {
            result.contactSource = 'scrapeak';
            result.confidence = 'high';
          }
        } else {
          result.strategies.push({ name: 'scrapeak', attempted: true, found: false, fieldsFound: [], durationMs: Date.now() - sStart, cost: 0.02, error: 'property fetch failed' });
        }
      } else {
        result.strategies.push({ name: 'scrapeak', attempted: true, found: false, fieldsFound: [], durationMs: Date.now() - sStart, cost: 0.01, error: 'no zpid found' });
      }
    } catch (err: any) {
      result.strategies.push({ name: 'scrapeak', attempted: true, found: false, fieldsFound: [], durationMs: Date.now() - sStart, cost: 0, error: err.message });
    }
  }

  // If we already have an email, stop
  if (result.ownerEmail) {
    await storeAndLog(req, result);
    return result;
  }

  // ── Strategy 4: Apollo lookup ──
  // Use broker name or agent name to find a verified email
  const apolloStart = Date.now();
  try {
    let apolloResult = null;

    if (result.brokerName) {
      // Search for someone at the brokerage/property management company
      apolloResult = await lookupByOrganization(result.brokerName, req.city, req.state);
    } else if (result.agentName) {
      // Try matching the agent by name
      const { firstName, lastName, isCorporate } = parseName(result.agentName);
      if (!isCorporate && firstName && lastName) {
        apolloResult = await lookupByName(firstName, lastName, result.brokerName || undefined, req.city, req.state);
      }
    }

    if (apolloResult?.email) {
      result.ownerEmail = apolloResult.email;
      const fieldsFound = ['ownerEmail'];
      if (apolloResult.fullName && !result.agentName) {
        result.agentName = apolloResult.fullName;
        fieldsFound.push('agentName');
      }
      result.strategies.push({
        name: 'apollo', attempted: true, found: true,
        fieldsFound, durationMs: Date.now() - apolloStart, cost: 0.01,
      });
      result.contactSource = 'apollo';
      result.confidence = 'high';
    } else {
      result.strategies.push({
        name: 'apollo', attempted: true, found: false,
        fieldsFound: [], durationMs: Date.now() - apolloStart, cost: apolloResult ? 0.01 : 0,
      });
    }
  } catch (err: any) {
    result.strategies.push({
      name: 'apollo', attempted: true, found: false,
      fieldsFound: [], durationMs: Date.now() - apolloStart, cost: 0, error: err.message,
    });
  }

  // If we have an email now, stop
  if (result.ownerEmail) {
    await storeAndLog(req, result);
    return result;
  }

  // ── Strategy 5: BatchData skip trace (last resort) ──
  if (process.env.BATCHDATA_API_KEY) {
    const bStart = Date.now();
    try {
      const skipResult = await skipTrace(req.address, req.city, req.state, req.zip);
      const fieldsFound: string[] = [];

      if (skipResult.ownerName && !result.ownerName) { result.ownerName = skipResult.ownerName; fieldsFound.push('ownerName'); }
      if (skipResult.ownerEmail && !result.ownerEmail) { result.ownerEmail = skipResult.ownerEmail; fieldsFound.push('ownerEmail'); }
      if (skipResult.ownerPhone && !result.ownerPhone) { result.ownerPhone = skipResult.ownerPhone; fieldsFound.push('ownerPhone'); }
      if (skipResult.ownerType !== 'unknown') { result.ownerType = skipResult.ownerType; }

      result.strategies.push({
        name: 'batchdata', attempted: true, found: fieldsFound.length > 0,
        fieldsFound, durationMs: Date.now() - bStart, cost: 0.02,
      });

      if (hasContactableInfo(result) && result.contactSource === 'none') {
        result.contactSource = 'batchdata';
        result.confidence = 'low'; // Public records — may be outdated
      }
    } catch (err: any) {
      result.strategies.push({
        name: 'batchdata', attempted: true, found: false,
        fieldsFound: [], durationMs: Date.now() - bStart, cost: 0, error: err.message,
      });
    }
  }

  await storeAndLog(req, result);
  return result;
}

/**
 * Enrich a batch of listings. Runs sequentially with delays.
 */
export async function enrichContactBatch(listings: EnrichmentRequest[]): Promise<EnrichmentResult[]> {
  const results: EnrichmentResult[] = [];

  for (let i = 0; i < listings.length; i++) {
    const r = await enrichContact(listings[i]);
    results.push(r);

    // Small delay between listings to avoid rate limits
    if (i < listings.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  return results;
}

/**
 * Store enriched contact data back to Locust listings table.
 */
async function storeAndLog(req: EnrichmentRequest, result: EnrichmentResult): Promise<void> {
  try {
    // Ensure columns exist
    await query(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS contact_source TEXT`).catch(() => {});
    await query(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS contact_enriched_at TIMESTAMPTZ`).catch(() => {});
    await query(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS contact_confidence TEXT`).catch(() => {});

    // Update the listing if we found anything
    if (result.contactSource !== 'none') {
      await query(
        `UPDATE listings SET
          owner_name = COALESCE($1, owner_name),
          owner_email = COALESCE($2, owner_email),
          owner_phone = COALESCE($3, owner_phone),
          owner_type = COALESCE($4, owner_type),
          agent_name = COALESCE($5, agent_name),
          agent_phone = COALESCE($6, agent_phone),
          broker_name = COALESCE($7, broker_name),
          contact_source = $8,
          contact_enriched_at = NOW(),
          contact_confidence = $9,
          updated_at = NOW()
        WHERE LOWER(address) = LOWER($10) AND LOWER(city) = LOWER($11) AND LOWER(state) = LOWER($12)`,
        [
          result.ownerName, result.ownerEmail, result.ownerPhone, result.ownerType,
          result.agentName, result.agentPhone, result.brokerName,
          result.contactSource, result.confidence,
          req.address, req.city, req.state,
        ]
      );
    }

    await logEnrichment(req, result);
  } catch (err) {
    console.error('Failed to store enrichment result:', err);
  }
}

/**
 * Log enrichment attempt to contact_enrichment_log table.
 */
async function logEnrichment(req: EnrichmentRequest, result: EnrichmentResult): Promise<void> {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS contact_enrichment_log (
        id SERIAL PRIMARY KEY,
        sweetlease_listing_id TEXT,
        address TEXT,
        city TEXT,
        state TEXT,
        contact_source TEXT,
        confidence TEXT,
        strategies JSONB,
        total_cost REAL,
        total_duration_ms INT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `).catch(() => {});

    const totalCost = result.strategies.reduce((sum, s) => sum + s.cost, 0);
    const totalDuration = result.strategies.reduce((sum, s) => sum + s.durationMs, 0);

    await query(
      `INSERT INTO contact_enrichment_log (sweetlease_listing_id, address, city, state, contact_source, confidence, strategies, total_cost, total_duration_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        req.sweetleaseListingId || null,
        req.address, req.city, req.state,
        result.contactSource, result.confidence,
        JSON.stringify(result.strategies),
        totalCost, totalDuration,
      ]
    );
  } catch (err) {
    console.error('Failed to log enrichment:', err);
  }
}
