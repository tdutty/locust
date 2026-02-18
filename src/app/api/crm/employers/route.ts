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
      return NextResponse.json({
        employers: [],
        total: 0,
        source: 'none',
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
    return NextResponse.json({
      employers: [],
      total: 0,
      source: 'none',
    });
  }
}
