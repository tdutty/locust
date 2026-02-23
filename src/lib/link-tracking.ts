import crypto from 'crypto';
import { query } from '@/lib/db';

/**
 * Generate a random 8-character alphanumeric code.
 */
export function generateShortCode(): string {
  return crypto.randomBytes(6).toString('base64url').slice(0, 8);
}

/**
 * Create a tracked link and return the tracking URL.
 */
export async function createTrackedLink(
  destinationUrl: string,
  contactId: number | null,
  scheduledEmailId: number | null
): Promise<string> {
  const code = generateShortCode();
  await query(
    `INSERT INTO tracked_links (code, destination_url, contact_id, scheduled_email_id)
     VALUES ($1, $2, $3, $4)`,
    [code, destinationUrl, contactId, scheduledEmailId]
  );
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://locust-m7ng3.ondigitalocean.app';
  return `${baseUrl}/api/t/${code}`;
}

/**
 * Find all href="https://..." links in HTML and replace each with a tracked redirect URL.
 * Skips mailto: links and unsubscribe links.
 */
export async function wrapLinksForTracking(
  html: string,
  contactId: number | null,
  scheduledEmailId: number | null
): Promise<string> {
  // Match href="https://..." but not mailto: links
  const linkRegex = /href="(https?:\/\/[^"]+)"/g;
  const matches: { full: string; url: string }[] = [];

  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1];
    // Skip mailto links and unsubscribe mailto links
    if (url.startsWith('mailto:')) continue;
    // Skip the unsubscribe mailto link (already filtered by https check, but be safe)
    matches.push({ full: match[0], url });
  }

  let result = html;
  for (const m of matches) {
    const trackingUrl = await createTrackedLink(m.url, contactId, scheduledEmailId);
    result = result.replace(m.full, `href="${trackingUrl}"`);
  }

  return result;
}
