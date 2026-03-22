/**
 * Apollo.io contact lookup for property agents, brokers, and owners.
 * Used in the contact enrichment cascade to find verified emails.
 */

const APOLLO_API_KEY = process.env.APOLLO_API_KEY || '';

interface ApolloContactResult {
  email: string | null;
  emailStatus: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  fullName: string | null;
}

/**
 * Look up a person by name + organization using Apollo People Match.
 * Best for: individual property owners, named agents.
 */
export async function lookupByName(
  firstName: string,
  lastName: string,
  organization?: string,
  city?: string,
  state?: string
): Promise<ApolloContactResult> {
  if (!APOLLO_API_KEY) throw new Error('APOLLO_API_KEY not configured');

  const body: Record<string, any> = {
    first_name: firstName,
    last_name: lastName,
  };
  if (organization) body.organization_name = organization;
  if (city && state) body.person_locations = [`${city}, ${state}`];

  const resp = await fetch('https://api.apollo.io/api/v1/people/match', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': APOLLO_API_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Apollo match error ${resp.status}: ${text}`);
  }

  const data = await resp.json();
  const person = data.person;
  if (!person) return { email: null, emailStatus: null, phone: null, linkedinUrl: null, fullName: null };

  return {
    email: person.email || null,
    emailStatus: person.email_status || null,
    phone: person.phone_numbers?.[0]?.sanitized_number || null,
    linkedinUrl: person.linkedin_url || null,
    fullName: person.name || `${person.first_name || ''} ${person.last_name || ''}`.trim() || null,
  };
}

/**
 * Search Apollo for people at a specific organization.
 * Best for: finding the right contact at a property management company.
 */
export async function lookupByOrganization(
  orgName: string,
  city?: string,
  state?: string,
  titleKeywords?: string[]
): Promise<ApolloContactResult> {
  if (!APOLLO_API_KEY) throw new Error('APOLLO_API_KEY not configured');

  const body: Record<string, any> = {
    q_organization_keyword_tags: [orgName],
    person_titles: titleKeywords || ['manager', 'leasing', 'property manager', 'agent'],
    per_page: 5,
    page: 1,
  };
  if (city && state) body.person_locations = [`${city}, ${state}`];

  const resp = await fetch('https://api.apollo.io/api/v1/mixed_people/api_search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': APOLLO_API_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Apollo org search error ${resp.status}: ${text}`);
  }

  const data = await resp.json();
  const people = data.people || [];
  if (people.length === 0) return { email: null, emailStatus: null, phone: null, linkedinUrl: null, fullName: null };

  // Found a match — reveal it to get full contact details
  const personId = people[0].id;
  const revealResp = await fetch('https://api.apollo.io/api/v1/people/match', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': APOLLO_API_KEY,
    },
    body: JSON.stringify({ id: personId, reveal_personal_emails: false }),
  });

  if (!revealResp.ok) return { email: null, emailStatus: null, phone: null, linkedinUrl: null, fullName: null };

  const revealData = await revealResp.json();
  const person = revealData.person;
  if (!person) return { email: null, emailStatus: null, phone: null, linkedinUrl: null, fullName: null };

  return {
    email: person.email || null,
    emailStatus: person.email_status || null,
    phone: person.phone_numbers?.[0]?.sanitized_number || null,
    linkedinUrl: person.linkedin_url || null,
    fullName: person.name || null,
  };
}

/**
 * Parse a name string into first/last name.
 * Handles: "John Smith", "SMITH JOHN", "Smith, John", "Smith John LLC" (corporate).
 */
export function parseName(name: string): { firstName: string; lastName: string; isCorporate: boolean } {
  const corporatePatterns = /\b(LLC|INC|CORP|LP|LTD|TRUST|PARTNERSHIP|ASSOCIATES|HOLDINGS|PROPERTIES|MANAGEMENT|GROUP|ENTERPRISES)\b/i;
  if (corporatePatterns.test(name)) {
    return { firstName: '', lastName: '', isCorporate: true };
  }

  // Remove extra whitespace
  const cleaned = name.replace(/\s+/g, ' ').trim();

  // "Last, First" format
  if (cleaned.includes(',')) {
    const [last, first] = cleaned.split(',').map(s => s.trim());
    return { firstName: first || '', lastName: last || '', isCorporate: false };
  }

  const parts = cleaned.split(' ');
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '', isCorporate: false };
  }

  // If all caps and 2 parts, could be "LAST FIRST"
  if (parts.length === 2 && cleaned === cleaned.toUpperCase()) {
    return { firstName: parts[1], lastName: parts[0], isCorporate: false };
  }

  // Standard "First Last" or "First Middle Last"
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
    isCorporate: false,
  };
}
