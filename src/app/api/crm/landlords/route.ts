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
      id: String(o.id),
      name: o.owner_name || '',
      email: o.email || '',
      phone: o.phone || '',
      property_count: o.portfolio_size || 0,
      total_units: o.total_units || 0,
      avg_rent: parseFloat(o.avg_rent) || 0,
      city: o.mailing_city || '',
      state: o.mailing_state || '',
      score: o.lead_score || 0,
      status: (o.status || 'new').toLowerCase(),
      source: 'grasshopper',
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
    { id: '1', name: 'Alexander Phillips', email: 'alex.phillips@gmail.com', phone: '(512) 555-0101', city: 'Austin', state: 'TX', property_count: 47, total_units: 312, avg_rent: 2200, score: 92, status: 'new', source: 'sample' },
    { id: '2', name: 'Robert Chen', email: 'rchen@propertymgmt.com', phone: '(512) 555-0102', city: 'Austin', state: 'TX', property_count: 23, total_units: 156, avg_rent: 1800, score: 85, status: 'contacted', source: 'sample' },
    { id: '3', name: 'Sarah Johnson', email: 'sjohnson@realestate.net', phone: '(713) 555-0103', city: 'Houston', state: 'TX', property_count: 34, total_units: 228, avg_rent: 1900, score: 88, status: 'new', source: 'sample' },
    { id: '4', name: 'Michael Williams', email: 'mwilliams@outlook.com', phone: '(214) 555-0104', city: 'Dallas', state: 'TX', property_count: 19, total_units: 127, avg_rent: 1750, score: 76, status: 'qualified', source: 'sample' },
    { id: '5', name: 'Jennifer Martinez', email: 'jmartinez@gmail.com', phone: '(512) 555-0105', city: 'Austin', state: 'TX', property_count: 28, total_units: 189, avg_rent: 2100, score: 81, status: 'new', source: 'sample' },
    { id: '6', name: 'David Thompson', email: 'dthompson@txproperties.com', phone: '(210) 555-0106', city: 'San Antonio', state: 'TX', property_count: 15, total_units: 98, avg_rent: 1600, score: 72, status: 'contacted', source: 'sample' },
    { id: '7', name: 'Amanda Garcia', email: 'agarcia@rentals.com', phone: '(713) 555-0107', city: 'Houston', state: 'TX', property_count: 42, total_units: 284, avg_rent: 2300, score: 90, status: 'new', source: 'sample' },
    { id: '8', name: 'Kevin Lee', email: 'klee@propertyinvest.com', phone: '(512) 555-0108', city: 'Austin', state: 'TX', property_count: 31, total_units: 207, avg_rent: 1850, score: 84, status: 'qualified', source: 'sample' },
  ];
}
