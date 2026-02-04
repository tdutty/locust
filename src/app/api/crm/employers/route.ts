import { NextRequest, NextResponse } from 'next/server';

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
    return NextResponse.json({
      ...data,
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
    { id: '1', company: 'Tesla', industry: 'Automotive', location: 'Austin, TX', relocationsPerYear: 450, contact: 'hr@tesla.com', hrManager: 'Emily Chen', status: 'new', lastContact: null },
    { id: '2', company: 'Delta Airlines', industry: 'Aviation', location: 'Atlanta, GA', relocationsPerYear: 890, contact: 'relocation@delta.com', hrManager: 'James Wilson', status: 'contacted', lastContact: '2024-01-14' },
    { id: '3', company: 'Apple', industry: 'Technology', location: 'Austin, TX', relocationsPerYear: 620, contact: 'mobility@apple.com', hrManager: 'Sarah Park', status: 'new', lastContact: null },
    { id: '4', company: 'Bank of America', industry: 'Financial', location: 'Charlotte, NC', relocationsPerYear: 1200, contact: 'hr.relocations@bofa.com', hrManager: 'Michael Torres', status: 'qualified', lastContact: '2024-01-18' },
    { id: '5', company: 'Oracle', industry: 'Technology', location: 'Austin, TX', relocationsPerYear: 380, contact: 'relocation@oracle.com', hrManager: 'Lisa Wang', status: 'new', lastContact: null },
    { id: '6', company: 'Boeing Defense', industry: 'Aerospace', location: 'Arlington, VA', relocationsPerYear: 560, contact: 'mobility@boeing.com', hrManager: 'Robert Martinez', status: 'contacted', lastContact: '2024-01-16' },
    { id: '7', company: 'Amazon', industry: 'Technology', location: 'Austin, TX', relocationsPerYear: 2100, contact: 'relocation@amazon.com', hrManager: 'Jennifer Adams', status: 'new', lastContact: null },
    { id: '8', company: 'Lockheed Martin', industry: 'Aerospace', location: 'Fort Worth, TX', relocationsPerYear: 420, contact: 'hr@lockheedmartin.com', hrManager: 'David Kim', status: 'qualified', lastContact: '2024-01-19' },
  ];
}
