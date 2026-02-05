import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const CRICKET_API_URL = process.env.CRICKET_API_URL || 'http://198.199.78.62:8081';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const industry = searchParams.get('industry');
    const status = searchParams.get('status');
    const minRelocations = searchParams.get('minRelocations');
    const limit = searchParams.get('limit') || '50';
    const offset = searchParams.get('offset') || '0';

    // Build query parameters for Cricket API
    const params = new URLSearchParams();
    if (industry) params.append('industry', industry);
    if (status) params.append('status', status);
    if (minRelocations) params.append('minRelocations', minRelocations);
    params.append('limit', limit);
    params.append('offset', offset);

    // Fetch from Cricket CRM
    const response = await fetch(`${CRICKET_API_URL}/api/employers?${params.toString()}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      // If Cricket is unavailable, return sample data
      return NextResponse.json({
        employers: getSampleEmployers(),
        total: 99,
        source: 'sample',
      });
    }

    const data = await response.json();

    // Cricket API returns a raw array — wrap and map to Locust Employer format
    const employers = (Array.isArray(data) ? data : data.employers || []).map((e: any) => ({
      id: String(e.id),
      company: e.name || e.company || '',
      contact_name: e.contact_name || 'HR Department',
      contact_title: e.contact_title || '',
      contact_email: e.contact_email || '',
      phone: e.phone || '',
      relocation_count: e.avg_relocations_per_year ?? e.relocation_count ?? 0,
      city: e.city || '',
      state: e.state || '',
      industry: (e.industry || '').charAt(0).toUpperCase() + (e.industry || '').slice(1).toLowerCase(),
      employees: e.employee_count ?? e.employees ?? 0,
      score: e.lead_score ?? e.score ?? 0,
      status: (e.status || 'new').toLowerCase(),
    }));

    return NextResponse.json({
      employers,
      total: employers.length,
      source: 'cricket',
    });
  } catch (error) {
    console.error('Error fetching employers:', error);
    // Return sample data on error
    return NextResponse.json({
      employers: getSampleEmployers(),
      total: 99,
      source: 'sample',
    });
  }
}

function getSampleEmployers() {
  return [
    { id: '1', company: 'Tesla', contact_name: 'Emily Chen', contact_title: 'VP of HR', contact_email: 'hr@tesla.com', phone: '(512) 516-8177', relocation_count: 850, city: 'Austin', state: 'TX', industry: 'Automotive', employees: 127000, score: 95, status: 'new' },
    { id: '2', company: 'Delta Air Lines', contact_name: 'James Wilson', contact_title: 'Relocation Manager', contact_email: 'relocation@delta.com', phone: '(404) 715-2600', relocation_count: 650, city: 'Atlanta', state: 'GA', industry: 'Airlines', employees: 95000, score: 90, status: 'contacted' },
    { id: '3', company: 'Apple', contact_name: 'Sarah Park', contact_title: 'HR Operations', contact_email: 'mobility@apple.com', phone: '(512) 555-0203', relocation_count: 520, city: 'Austin', state: 'TX', industry: 'Technology', employees: 164000, score: 88, status: 'new' },
    { id: '4', company: 'Bank of America', contact_name: 'Michael Torres', contact_title: 'Relocation Director', contact_email: 'hr.relocations@bofa.com', phone: '(704) 386-5000', relocation_count: 450, city: 'Charlotte', state: 'NC', industry: 'Finance', employees: 213000, score: 85, status: 'qualified' },
    { id: '5', company: 'Oracle', contact_name: 'Lisa Wang', contact_title: 'People Ops', contact_email: 'relocation@oracle.com', phone: '(512) 555-0206', relocation_count: 380, city: 'Austin', state: 'TX', industry: 'Technology', employees: 143000, score: 80, status: 'new' },
    { id: '6', company: 'Boeing Defense', contact_name: 'Robert Martinez', contact_title: 'HR Manager', contact_email: 'mobility@boeing.com', phone: '(843) 555-0205', relocation_count: 560, city: 'Arlington', state: 'VA', industry: 'Aerospace', employees: 142000, score: 82, status: 'contacted' },
    { id: '7', company: 'Amazon', contact_name: 'Jennifer Adams', contact_title: 'Mobility Director', contact_email: 'relocation@amazon.com', phone: '(512) 555-0207', relocation_count: 2100, city: 'Austin', state: 'TX', industry: 'Technology', employees: 1500000, score: 92, status: 'new' },
    { id: '8', company: 'Lockheed Martin', contact_name: 'David Kim', contact_title: 'Relocation Coordinator', contact_email: 'hr@lockheedmartin.com', phone: '(817) 555-0208', relocation_count: 420, city: 'Fort Worth', state: 'TX', industry: 'Aerospace', employees: 116000, score: 78, status: 'qualified' },
  ];
}
