/**
 * BatchData Skip Trace API — property owner contact lookup.
 * Used as last resort in the contact enrichment cascade.
 * Docs: https://batchdata.io/api-solutions
 */

const BATCHDATA_API_KEY = process.env.BATCHDATA_API_KEY || '';
const BASE_URL = 'https://api.batchdata.com/api/v1';

export interface SkipTraceResult {
  ownerName: string | null;
  ownerEmail: string | null;
  ownerPhone: string | null;
  ownerType: 'individual' | 'corporate' | 'unknown';
  emails: string[];
  phones: Array<{ number: string; type: string }>;
}

export async function skipTrace(address: string, city: string, state: string, zip: string): Promise<SkipTraceResult> {
  if (!BATCHDATA_API_KEY) {
    throw new Error('BATCHDATA_API_KEY not configured');
  }

  const resp = await fetch(`${BASE_URL}/property/skip-trace`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${BATCHDATA_API_KEY}`,
    },
    body: JSON.stringify({
      requests: [
        {
          propertyAddress: {
            street: address,
            city,
            state,
            zip,
          },
        },
      ],
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`BatchData API error ${resp.status}: ${text}`);
  }

  const data = await resp.json();
  const result: SkipTraceResult = {
    ownerName: null,
    ownerEmail: null,
    ownerPhone: null,
    ownerType: 'unknown',
    emails: [],
    phones: [],
  };

  // Response: { status, results: { persons: [...] } }
  const persons = data?.results?.persons || [];
  if (persons.length === 0) return result;

  const person = persons[0]; // Primary person/owner

  // Name from person.name object
  const nameObj = person.name || {};
  const firstName = nameObj.first || '';
  const lastName = nameObj.last || '';
  result.ownerName = nameObj.full || [firstName, lastName].filter(Boolean).join(' ') || null;

  // Detect corporate vs individual
  const name = result.ownerName || '';
  const corporatePatterns = /\b(LLC|INC|CORP|LP|LTD|TRUST|PARTNERSHIP|ASSOCIATES|HOLDINGS|PROPERTIES|MANAGEMENT|GROUP|ENTERPRISES)\b/i;
  result.ownerType = corporatePatterns.test(name) ? 'corporate' : 'individual';

  // Emails
  const emails = person.emails || [];
  result.emails = emails.map((e: any) => e.email || e).filter(Boolean);
  result.ownerEmail = result.emails[0] || null;

  // Phones — prefer mobile/cell, then reachable, then highest score
  const phones = person.phoneNumbers || [];
  result.phones = phones.map((p: any) => ({
    number: p.number || '',
    type: p.type || 'unknown',
  })).filter((p: { number: string }) => p.number);

  // Priority: Mobile > reachable landline > any
  const mobile = phones.find((p: any) => /mobile|cell|wireless/i.test(p.type));
  const reachable = phones.find((p: any) => p.reachable === true);
  const best = mobile || reachable || phones[0];
  result.ownerPhone = best?.number || null;

  return result;
}
