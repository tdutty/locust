import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const GRASSHOPPER_API_URL = process.env.GRASSHOPPER_API_URL || 'http://198.199.78.62:8080';

// Cache the access token in memory
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getGrasshopperToken(): Promise<string | null> {
  const email = process.env.GRASSHOPPER_EMAIL;
  const password = process.env.GRASSHOPPER_PASSWORD;
  if (!email || !password) return null;

  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
    return cachedToken.token;
  }

  const res = await fetch(`${GRASSHOPPER_API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) return null;

  const data = await res.json();
  // Token expires in 15 minutes per Grasshopper config
  cachedToken = {
    token: data.accessToken,
    expiresAt: Date.now() + 14 * 60 * 1000,
  };
  return cachedToken.token;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const city = searchParams.get('city');
    const status = searchParams.get('status');
    const minProperties = searchParams.get('minProperties');
    const limit = searchParams.get('limit') || '50';
    const offset = searchParams.get('offset') || '0';

    const token = await getGrasshopperToken();
    if (!token) {
      return NextResponse.json({
        landlords: getSampleLandlords(),
        total: 166,
        source: 'sample',
      });
    }

    // Build query parameters for Grasshopper API
    const params = new URLSearchParams();
    if (city) params.append('search', city);
    if (status) params.append('status', status.toUpperCase());
    if (minProperties) params.append('minScore', minProperties);
    params.append('limit', limit);
    params.append('offset', offset);

    // Fetch from Grasshopper CRM — correct endpoint is /api/owners
    const response = await fetch(`${GRASSHOPPER_API_URL}/api/owners?${params.toString()}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      // Token might be expired, clear cache and fall back
      cachedToken = null;
      return NextResponse.json({
        landlords: getSampleLandlords(),
        total: 166,
        source: 'sample',
      });
    }

    const data = await response.json();

    // Map Grasshopper owner format to Locust landlord format
    const landlords = (data.owners || []).map((o: any) => ({
      id: o.id,
      name: o.owner_name,
      owner_type: o.owner_type,
      city: o.mailing_city,
      state: o.mailing_state,
      properties: o.portfolio_size,
      units: o.total_units,
      total_value: parseFloat(o.total_value) || 0,
      score: o.lead_score,
      grade: o.lead_grade,
      status: (o.status || 'new').toLowerCase(),
      regions: o.regions,
      phone_count: parseInt(o.phone_count) || 0,
      email_count: parseInt(o.email_count) || 0,
      last_outreach: o.last_outreach_at,
    }));

    return NextResponse.json({
      landlords,
      total: data.total || landlords.length,
      source: 'grasshopper',
    });
  } catch (error) {
    console.error('Error fetching landlords:', error);
    return NextResponse.json({
      landlords: getSampleLandlords(),
      total: 166,
      source: 'sample',
    });
  }
}

function getSampleLandlords() {
  return [
    { id: '1', name: 'Alexander Phillips', email: 'alex.phillips@gmail.com', phone: '(512) 555-0101', city: 'Austin', properties: 47, units: 312, score: 92, status: 'new', lastContact: null },
    { id: '2', name: 'Robert Chen', email: 'rchen@propertymgmt.com', phone: '(512) 555-0102', city: 'Austin', properties: 23, units: 156, score: 85, status: 'contacted', lastContact: '2024-01-15' },
    { id: '3', name: 'Sarah Johnson', email: 'sjohnson@realestate.net', phone: '(713) 555-0103', city: 'Houston', properties: 34, units: 228, score: 88, status: 'new', lastContact: null },
    { id: '4', name: 'Michael Williams', email: 'mwilliams@outlook.com', phone: '(214) 555-0104', city: 'Dallas', properties: 19, units: 127, score: 76, status: 'qualified', lastContact: '2024-01-18' },
    { id: '5', name: 'Jennifer Martinez', email: 'jmartinez@gmail.com', phone: '(512) 555-0105', city: 'Austin', properties: 28, units: 189, score: 81, status: 'new', lastContact: null },
    { id: '6', name: 'David Thompson', email: 'dthompson@txproperties.com', phone: '(210) 555-0106', city: 'San Antonio', properties: 15, units: 98, score: 72, status: 'contacted', lastContact: '2024-01-12' },
    { id: '7', name: 'Amanda Garcia', email: 'agarcia@rentals.com', phone: '(713) 555-0107', city: 'Houston', properties: 42, units: 284, score: 90, status: 'new', lastContact: null },
    { id: '8', name: 'Kevin Lee', email: 'klee@propertyinvest.com', phone: '(512) 555-0108', city: 'Austin', properties: 31, units: 207, score: 84, status: 'qualified', lastContact: '2024-01-20' },
  ];
}
