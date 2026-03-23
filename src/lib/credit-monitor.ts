/**
 * Credit Monitor — tracks API credit balances for Scrapeak and BatchData.
 * Sends email alerts when credits are low or depleted.
 */

import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const ALERT_EMAIL = process.env.ADMIN_EMAIL || 'tgilbert@sweetlease.io';
const ALERT_FROM = 'SweetLease Alerts <no-reply@sweetlease.io>';

// Thresholds
const SCRAPEAK_LOW_THRESHOLD = 500;
const SCRAPEAK_CRITICAL_THRESHOLD = 100;

// Track last alert time to avoid spamming (1 alert per service per hour)
const lastAlertSent: Record<string, number> = {};
const ALERT_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

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

/**
 * Check Scrapeak credits after an API response.
 * Call this after every Scrapeak API call.
 */
export async function checkScrapeak(remainingCredits: number | undefined) {
  if (remainingCredits === undefined || remainingCredits === null) return;

  console.log(`[credit-monitor] Scrapeak credits: ${remainingCredits}`);

  if (remainingCredits <= 0) {
    if (shouldAlert('scrapeak-depleted')) {
      await sendAlert(
        '🚨 Scrapeak Credits DEPLETED',
        `<div style="font-family: sans-serif; padding: 20px;">
          <h2 style="color: #dc2626;">Scrapeak Credits Depleted</h2>
          <p>Scrapeak has <strong>0 credits remaining</strong>. All Zillow property lookups and listing searches will fail.</p>
          <p><strong>Action required:</strong> Top up credits at <a href="https://app.scrapeak.com">app.scrapeak.com</a></p>
          <p style="color: #666; font-size: 12px;">Affected: listing enrichment, city scans, contact enrichment (strategy 3)</p>
        </div>`
      );
    }
  } else if (remainingCredits <= SCRAPEAK_CRITICAL_THRESHOLD) {
    if (shouldAlert('scrapeak-critical')) {
      await sendAlert(
        `⚠️ Scrapeak Credits Critical: ${remainingCredits} remaining`,
        `<div style="font-family: sans-serif; padding: 20px;">
          <h2 style="color: #f59e0b;">Scrapeak Credits Critical</h2>
          <p><strong>${remainingCredits} credits remaining</strong> (critical threshold: ${SCRAPEAK_CRITICAL_THRESHOLD})</p>
          <p>At ~20 credits per listing enrichment, that's about <strong>${Math.floor(remainingCredits / 20)} more enrichments</strong>.</p>
          <p><strong>Action required:</strong> Top up credits at <a href="https://app.scrapeak.com">app.scrapeak.com</a></p>
        </div>`
      );
    }
  } else if (remainingCredits <= SCRAPEAK_LOW_THRESHOLD) {
    if (shouldAlert('scrapeak-low')) {
      await sendAlert(
        `Scrapeak Credits Low: ${remainingCredits} remaining`,
        `<div style="font-family: sans-serif; padding: 20px;">
          <h2 style="color: #f59e0b;">Scrapeak Credits Running Low</h2>
          <p><strong>${remainingCredits} credits remaining</strong> (low threshold: ${SCRAPEAK_LOW_THRESHOLD})</p>
          <p>At ~20 credits per listing enrichment, that's about <strong>${Math.floor(remainingCredits / 20)} more enrichments</strong>.</p>
          <p>Consider topping up at <a href="https://app.scrapeak.com">app.scrapeak.com</a></p>
        </div>`
      );
    }
  }
}

/**
 * Check BatchData response for credit issues.
 * Call this after every BatchData API call.
 */
export async function checkBatchData(statusCode: number, statusMessage?: string) {
  if (statusCode === 403 && statusMessage?.toLowerCase().includes('insufficient balance')) {
    if (shouldAlert('batchdata-depleted')) {
      await sendAlert(
        '🚨 BatchData Credits DEPLETED',
        `<div style="font-family: sans-serif; padding: 20px;">
          <h2 style="color: #dc2626;">BatchData Credits Depleted</h2>
          <p>BatchData returned <strong>"Insufficient balance"</strong>. All skip traces and property searches will fail.</p>
          <p><strong>Action required:</strong> Add credits at <a href="https://batchdata.io">batchdata.io</a></p>
          <p style="color: #666; font-size: 12px;">Affected: contact enrichment (strategy 5 - skip trace), property search</p>
        </div>`
      );
    }
  } else if (statusCode === 402) {
    if (shouldAlert('batchdata-payment')) {
      await sendAlert(
        '🚨 BatchData Payment Required',
        `<div style="font-family: sans-serif; padding: 20px;">
          <h2 style="color: #dc2626;">BatchData Payment Required</h2>
          <p>BatchData returned status <strong>402 Payment Required</strong>.</p>
          <p><strong>Action required:</strong> Check billing at <a href="https://batchdata.io">batchdata.io</a></p>
        </div>`
      );
    }
  }
}

/**
 * Check Apollo credits. Apollo returns 402 when out of credits.
 */
export async function checkApollo(statusCode: number, statusMessage?: string) {
  if (statusCode === 402 || statusCode === 403) {
    if (shouldAlert('apollo-depleted')) {
      await sendAlert(
        '🚨 Apollo Credits DEPLETED',
        `<div style="font-family: sans-serif; padding: 20px;">
          <h2 style="color: #dc2626;">Apollo Credits Depleted</h2>
          <p>Apollo returned status <strong>${statusCode}</strong>: ${statusMessage || 'insufficient credits'}</p>
          <p><strong>Action required:</strong> Check your Apollo plan at <a href="https://app.apollo.io">app.apollo.io</a></p>
          <p style="color: #666; font-size: 12px;">Affected: contact enrichment (strategy 4 - email lookup)</p>
        </div>`
      );
    }
  }
}
