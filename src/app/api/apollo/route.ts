import { NextRequest, NextResponse } from 'next/server';

const APOLLO_API_URL = 'https://api.apollo.io/api/v1';
const APOLLO_API_KEY = process.env.APOLLO_API_KEY || '';

// Pre-built search templates for SweetLease target personas
const SEARCH_TEMPLATES: Record<string, any> = {
  'residency-coordinators': {
    person_titles: [
      'Residency Program Coordinator',
      'GME Coordinator',
      'Graduate Medical Education Coordinator',
      'Residency Program Director',
      'Residency Program Administrator',
      'GME Program Manager',
      'Medical Education Coordinator',
      'Residency Program Manager',
      'Associate Program Director',
      'GME Administrator',
    ],
    organization_industry_tag_ids: [], // Healthcare
    q_organization_keyword_tags: ['hospital', 'medical center', 'health system', 'teaching hospital', 'academic medical center'],
  },
  'graduate-housing': {
    person_titles: [
      'Director of Housing',
      'Housing Director',
      'Director of Residential Life',
      'Off-Campus Housing Coordinator',
      'Student Housing Director',
      'Associate Director of Housing',
      'Housing Operations Director',
      'Director of Auxiliary Services',
      'Graduate Housing Coordinator',
      'Assistant Director of Housing',
    ],
    q_organization_keyword_tags: ['university', 'college', 'school'],
  },
  'benefits-platforms': {
    person_titles: [
      'Head of Partnerships',
      'VP of Partnerships',
      'Director of Partnerships',
      'Business Development Manager',
      'Partnership Manager',
      'VP Business Development',
      'Head of Strategic Partnerships',
      'Director of Business Development',
      'Channel Partnerships Manager',
      'VP of Alliances',
    ],
    q_organization_keyword_tags: ['employee benefits', 'HR tech', 'perks', 'lifestyle spending', 'benefits platform'],
    organization_names: [
      'Forma', 'Benepass', 'Compt', 'Rippling', 'Gusto', 'Justworks',
      'PerkBox', 'WorkTango', 'Hoppier', 'Deel', 'Zenefits',
    ],
  },
  'employer-relocation': {
    person_titles: [
      'Relocation Manager',
      'Global Mobility Manager',
      'HR Director',
      'VP of People',
      'Head of People Operations',
      'Director of Employee Experience',
      'Talent Acquisition Director',
      'Chief People Officer',
      'VP Human Resources',
      'Head of Total Rewards',
    ],
    person_locations: ['United States'],
    organization_num_employees_ranges: ['51,200', '201,500', '501,1000', '1001,5000', '5001,10000'],
  },
  'landlord-contacts': {
    person_titles: [
      'Property Manager',
      'Leasing Director',
      'VP of Property Management',
      'Multifamily Asset Manager',
      'Director of Leasing',
      'Regional Property Manager',
      'Director of Property Management',
      'Leasing Manager',
      'VP of Asset Management',
      'Director of Residential Operations',
    ],
    q_organization_keyword_tags: ['property management', 'real estate', 'multifamily', 'apartment', 'residential'],
    organization_num_employees_ranges: ['11,50', '51,200', '201,500', '501,1000', '1001,5000'],
  },
};

// Map templates to contact types
const TEMPLATE_TYPE_MAP: Record<string, string> = {
  'residency-coordinators': 'residency',
  'graduate-housing': 'university',
  'employer-relocation': 'employer',
  'benefits-platforms': 'employer',
  'landlord-contacts': 'landlord',
};

/**
 * POST /api/apollo — Search Apollo.io for contacts
 * Uses two-step flow: api_search (get IDs) → bulk_match (get full details)
 */
export async function POST(req: NextRequest) {
  if (!APOLLO_API_KEY) {
    return NextResponse.json(
      { error: 'Apollo API key not configured. Add APOLLO_API_KEY to .env.local' },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    const { template, page = 1, perPage = 25, customFilters } = body;

    // Build the search payload
    let searchPayload: any = {
      page,
      per_page: perPage,
    };

    // Apply template if provided
    if (template && SEARCH_TEMPLATES[template]) {
      searchPayload = { ...searchPayload, ...SEARCH_TEMPLATES[template] };
    }

    // Merge custom filters on top
    if (customFilters) {
      if (customFilters.titles?.length) {
        searchPayload.person_titles = customFilters.titles;
      }
      if (customFilters.locations?.length) {
        searchPayload.person_locations = customFilters.locations;
      }
      if (customFilters.keywords) {
        searchPayload.q_keywords = customFilters.keywords;
      }
      if (customFilters.organizationKeywords?.length) {
        searchPayload.q_organization_keyword_tags = customFilters.organizationKeywords;
      }
      if (customFilters.employeeRanges?.length) {
        searchPayload.organization_num_employees_ranges = customFilters.employeeRanges;
      }
    }

    // Step 1: Search for people (returns IDs + preview data)
    const searchResponse = await fetch(`${APOLLO_API_URL}/mixed_people/api_search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'x-api-key': APOLLO_API_KEY,
      },
      body: JSON.stringify(searchPayload),
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error('[Apollo Search Error]', searchResponse.status, errorText);
      return NextResponse.json(
        { error: `Apollo API error: ${searchResponse.status}`, details: errorText },
        { status: searchResponse.status }
      );
    }

    const searchData = await searchResponse.json();
    const people = searchData.people || [];
    const totalEntries = searchData.total_entries || 0;

    if (people.length === 0) {
      return NextResponse.json({
        contacts: [],
        pagination: { page, perPage, totalEntries: 0, totalPages: 0 },
      });
    }

    // Step 2: Enrich with bulk_match in batches of 10 (API limit)
    let enrichedPeople: any[] = [];
    const BATCH_SIZE = 10;
    for (let i = 0; i < people.length; i += BATCH_SIZE) {
      const batch = people.slice(i, i + BATCH_SIZE);
      try {
        const enrichResponse = await fetch(`${APOLLO_API_URL}/people/bulk_match`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': APOLLO_API_KEY,
          },
          body: JSON.stringify({
            details: batch.map((p: any) => ({ id: p.id })),
          }),
        });

        if (enrichResponse.ok) {
          const enrichData = await enrichResponse.json();
          const matches = (enrichData.matches || []).filter(Boolean);
          enrichedPeople.push(...matches);
        }
      } catch (e) {
        console.error('[Apollo Enrich Batch Error]', e);
      }
    }

    // Build a lookup map from enriched data
    const enrichMap = new Map<string, any>();
    for (const person of enrichedPeople) {
      enrichMap.set(person.id, person);
    }

    // Determine contact type from template
    const contactType = template ? (TEMPLATE_TYPE_MAP[template] || null) : null;

    // Transform contacts — use enriched data when available, fall back to search data
    const contacts = people.map((searchPerson: any) => {
      const enriched = enrichMap.get(searchPerson.id);

      if (enriched) {
        return {
          id: enriched.id,
          firstName: enriched.first_name,
          lastName: enriched.last_name,
          name: enriched.name || `${enriched.first_name || ''} ${enriched.last_name || ''}`.trim(),
          title: enriched.title,
          email: enriched.email,
          emailStatus: enriched.email_status,
          phone: enriched.phone_numbers?.[0]?.raw_number || enriched.sanitized_phone || null,
          linkedinUrl: enriched.linkedin_url,
          city: enriched.city,
          state: enriched.state,
          country: enriched.country,
          contactType,
          organization: {
            id: enriched.organization_id || enriched.organization?.id,
            name: enriched.organization?.name || enriched.employment_history?.[0]?.organization_name,
            website: enriched.organization?.website_url,
            industry: enriched.organization?.industry,
            employeeCount: enriched.organization?.estimated_num_employees,
            city: enriched.organization?.city,
            state: enriched.organization?.state,
          },
        };
      }

      // Fallback to search preview data
      return {
        id: searchPerson.id,
        firstName: searchPerson.first_name,
        lastName: null,
        name: searchPerson.first_name || 'Unknown',
        title: searchPerson.title,
        email: null,
        emailStatus: null,
        phone: null,
        linkedinUrl: null,
        city: null,
        state: null,
        country: null,
        contactType,
        organization: {
          id: null,
          name: searchPerson.organization?.name,
          website: null,
          industry: null,
          employeeCount: null,
          city: null,
          state: null,
        },
      };
    });

    return NextResponse.json({
      contacts,
      pagination: {
        page,
        perPage,
        totalEntries,
        totalPages: Math.ceil(totalEntries / perPage),
      },
    });
  } catch (error: any) {
    console.error('[Apollo Route Error]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to search Apollo' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/apollo — Return available search templates
 */
export async function GET() {
  const templates = Object.entries(SEARCH_TEMPLATES).map(([key, value]) => ({
    id: key,
    name: key.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    titleCount: value.person_titles?.length || 0,
    titles: value.person_titles || [],
  }));

  return NextResponse.json({
    templates,
    hasApiKey: !!APOLLO_API_KEY,
  });
}
