/**
 * Credit Monitor — tracks API credit balances for all services.
 * Sends email alerts when credits are low or depleted.
 * Provides /api/admin/credit-status endpoint for Hive dashboard.
 */

import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const ALERT_EMAIL = process.env.ADMIN_EMAIL || 'tgilbert@sweetlease.io';
const ALERT_FROM = 'SweetLease Alerts <no-reply@sweetlease.io>';

// Thresholds
const HASDATA_LOW_THRESHOLD = 500;   // ~100 Zillow lookups
const HASDATA_CRITICAL_THRESHOLD = 100;
const SCRAPEAK_LOW_THRESHOLD = 500;
const SCRAPEAK_CRITICAL_THRESHOLD = 100;

// Track last alert time to avoid spamming (1 alert per service per hour)
const lastAlertSent: Record<string, number> = {};
const ALERT_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

// Cache last known credit balances for the status endpoint
const creditCache: Record<string, { credits: number | null; status: string; lastChecked: string; error?: string }> = {};

function shouldAlert(service: string): boolean {
  const last = lastAlertSent[service] || 0;
  if (Date.now() - last < ALERT_COOLDOWN_MS) return false;
  lastAlertSent[service] = Date.now();
  return true;
}

async function sendAlert(subject: string, html: string) {
  if (!RESEND_API_KEY) {
    console.error('[credit-monitor] No RESEND_API_KEY, cannot send alert');
    return;
  }
  try {
    const resend = new Resend(RESEND_API_KEY);
    await resend.emails.send({
      from: ALERT_FROM,
      to: ['terrellgilb5@gmail.com', ALERT_EMAIL],
      subject,
      html,
    });
    console.log(`[credit-monitor] Alert sent: ${subject}`);
  } catch (err: any) {
    console.error('[credit-monitor] Failed to send alert:', err.message);
  }
}

function updateCache(service: string, credits: number | null, status: string, error?: string) {
  creditCache[service] = { credits, status, lastChecked: new Date().toISOString(), error };
}

// ── HasData ──

export async function checkHasData(remainingCredits?: number) {
  // If credits passed from a response, use them
  if (remainingCredits !== undefined && remainingCredits !== null) {
    updateCache('hasdata', remainingCredits, remainingCredits <= 0 ? 'depleted' : remainingCredits <= HASDATA_CRITICAL_THRESHOLD ? 'critical' : remainingCredits <= HASDATA_LOW_THRESHOLD ? 'low' : 'ok');

    if (remainingCredits <= 0 && shouldAlert('hasdata-depleted')) {
      await sendAlert('HasData Credits DEPLETED', alertHtml('HasData', 0, 'All Zillow property lookups will fail.', 'https://hasdata.com/prices'));
    } else if (remainingCredits <= HASDATA_CRITICAL_THRESHOLD && shouldAlert('hasdata-critical')) {
      await sendAlert(`HasData Credits Critical: ${remainingCredits} remaining`, alertHtml('HasData', remainingCredits, `~${Math.floor(remainingCredits / 5)} Zillow lookups remaining.`, 'https://hasdata.com/prices'));
    } else if (remainingCredits <= HASDATA_LOW_THRESHOLD && shouldAlert('hasdata-low')) {
      await sendAlert(`HasData Credits Low: ${remainingCredits} remaining`, alertHtml('HasData', remainingCredits, `~${Math.floor(remainingCredits / 5)} Zillow lookups remaining.`, 'https://hasdata.com/prices'));
    }
    return;
  }

  // Otherwise, poll the HasData usage endpoint
  const key = process.env.HASDATA_API_KEY;
  if (!key) { updateCache('hasdata', null, 'no_key'); return; }

  try {
    const resp = await fetch('https://api.hasdata.com/user/me/usage', {
      headers: { 'x-api-key': key },
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) {
      updateCache('hasdata', null, 'error', `HTTP ${resp.status}`);
      return;
    }
    const data = await resp.json();
    const credits = data.availableCredits ?? null;
    await checkHasData(credits); // Recurse with actual value
  } catch (err: any) {
    updateCache('hasdata', null, 'error', err.message);
  }
}

// ── Scrapeak ──

export async function checkScrapeak(remainingCredits: number | undefined) {
  if (remainingCredits === undefined || remainingCredits === null) return;

  updateCache('scrapeak', remainingCredits, remainingCredits <= 0 ? 'depleted' : remainingCredits <= SCRAPEAK_CRITICAL_THRESHOLD ? 'critical' : remainingCredits <= SCRAPEAK_LOW_THRESHOLD ? 'low' : 'ok');

  if (remainingCredits <= 0 && shouldAlert('scrapeak-depleted')) {
    await sendAlert('Scrapeak Credits DEPLETED', alertHtml('Scrapeak', 0, 'All Zillow listing searches will fail.', 'https://app.scrapeak.com'));
  } else if (remainingCredits <= SCRAPEAK_CRITICAL_THRESHOLD && shouldAlert('scrapeak-critical')) {
    await sendAlert(`Scrapeak Credits Critical: ${remainingCredits} remaining`, alertHtml('Scrapeak', remainingCredits, `~${Math.floor(remainingCredits / 20)} enrichments remaining.`, 'https://app.scrapeak.com'));
  } else if (remainingCredits <= SCRAPEAK_LOW_THRESHOLD && shouldAlert('scrapeak-low')) {
    await sendAlert(`Scrapeak Credits Low: ${remainingCredits} remaining`, alertHtml('Scrapeak', remainingCredits, `~${Math.floor(remainingCredits / 20)} enrichments remaining.`, 'https://app.scrapeak.com'));
  }
}

// ── BatchData ──

export async function checkBatchData(statusCode: number, statusMessage?: string) {
  if (statusCode === 403 && statusMessage?.toLowerCase().includes('insufficient balance')) {
    updateCache('batchdata', 0, 'depleted');
    if (shouldAlert('batchdata-depleted')) {
      await sendAlert('BatchData Credits DEPLETED', alertHtml('BatchData', 0, 'All skip traces and property searches will fail.', 'https://batchdata.io'));
    }
  } else if (statusCode === 402) {
    updateCache('batchdata', 0, 'depleted');
    if (shouldAlert('batchdata-payment')) {
      await sendAlert('BatchData Payment Required', alertHtml('BatchData', 0, 'Payment required to continue.', 'https://batchdata.io'));
    }
  } else {
    // Successful call — mark as ok (we don't know exact balance)
    if (!creditCache['batchdata'] || creditCache['batchdata'].status === 'depleted') {
      updateCache('batchdata', null, 'ok');
    }
    creditCache['batchdata'].lastChecked = new Date().toISOString();
  }
}

// ── Apollo ──

export async function checkApollo(statusCode: number, statusMessage?: string) {
  if (statusCode === 402 || statusCode === 403) {
    updateCache('apollo', 0, 'depleted');
    if (shouldAlert('apollo-depleted')) {
      await sendAlert('Apollo Credits DEPLETED', alertHtml('Apollo', 0, `Status ${statusCode}: ${statusMessage || 'insufficient credits'}`, 'https://app.apollo.io'));
    }
  } else {
    if (!creditCache['apollo'] || creditCache['apollo'].status === 'depleted') {
      updateCache('apollo', null, 'ok');
    }
    creditCache['apollo'].lastChecked = new Date().toISOString();
  }
}

// ── Anthropic ──

export async function checkAnthropic() {
  const adminKey = process.env.ANTHROPIC_ADMIN_API_KEY;
  if (!adminKey) {
    // No admin key — try a simple API call to check if credits work
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) { updateCache('anthropic', null, 'no_key'); return; }

    try {
      // Lightweight call — just count tokens, costs almost nothing
      const resp = await fetch('https://api.anthropic.com/v1/messages/count_tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          messages: [{ role: 'user', content: 'hi' }],
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (resp.status === 402 || resp.status === 403) {
        updateCache('anthropic', 0, 'depleted');
        if (shouldAlert('anthropic-depleted')) {
          await sendAlert('Anthropic Credits DEPLETED', alertHtml('Anthropic', 0, 'Claude API calls will fail.', 'https://console.anthropic.com/settings/billing'));
        }
      } else if (resp.ok) {
        updateCache('anthropic', null, 'ok');
      } else {
        updateCache('anthropic', null, 'error', `HTTP ${resp.status}`);
      }
    } catch (err: any) {
      updateCache('anthropic', null, 'error', err.message);
    }
    return;
  }

  // With admin key — get actual cost data
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const resp = await fetch(
      `https://api.anthropic.com/v1/organizations/cost_report?starting_at=${startOfMonth}&ending_at=${now.toISOString()}&bucket_width=1d`,
      {
        headers: {
          'anthropic-version': '2023-06-01',
          'x-api-key': adminKey,
        },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (resp.ok) {
      const data = await resp.json();
      // Sum all costs this month
      const totalCost = (data.data || []).reduce((sum: number, bucket: any) => {
        return sum + (bucket.costs || []).reduce((bSum: number, c: any) => bSum + parseFloat(c.amount || '0'), 0);
      }, 0) / 100; // Convert cents to dollars

      updateCache('anthropic', null, 'ok');
      creditCache['anthropic'].credits = totalCost; // Store as "spent this month" (not remaining)
    } else {
      updateCache('anthropic', null, 'error', `HTTP ${resp.status}`);
    }
  } catch (err: any) {
    updateCache('anthropic', null, 'error', err.message);
  }
}

// ── Get all credit statuses (for Hive dashboard) ──

export async function getAllCreditStatus(): Promise<Record<string, { credits: number | null; status: string; lastChecked: string; error?: string }>> {
  // Refresh HasData and Anthropic (they have polling endpoints)
  await Promise.allSettled([
    checkHasData(),
    checkAnthropic(),
  ]);

  return {
    hasdata: creditCache['hasdata'] || { credits: null, status: 'unknown', lastChecked: '' },
    scrapeak: creditCache['scrapeak'] || { credits: null, status: 'unknown', lastChecked: '' },
    batchdata: creditCache['batchdata'] || { credits: null, status: 'unknown', lastChecked: '' },
    apollo: creditCache['apollo'] || { credits: null, status: 'unknown', lastChecked: '' },
    anthropic: creditCache['anthropic'] || { credits: null, status: 'unknown', lastChecked: '' },
  };
}

// ── Helper ──

function alertHtml(service: string, credits: number, message: string, url: string): string {
  const color = credits <= 0 ? '#dc2626' : '#f59e0b';
  const level = credits <= 0 ? 'DEPLETED' : 'Low';
  return `<div style="font-family: sans-serif; padding: 20px;">
    <h2 style="color: ${color};">${service} Credits ${level}</h2>
    <p><strong>${credits} credits remaining.</strong> ${message}</p>
    <p><strong>Action required:</strong> <a href="${url}">Top up credits</a></p>
  </div>`;
}
