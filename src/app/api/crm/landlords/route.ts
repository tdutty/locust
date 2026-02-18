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
        landlords: [],
        total: 0,
        source: 'none',
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
      // Token might be expired, clear cache
      cachedToken = null;
      return NextResponse.json({
        landlords: [],
        total: 0,
        source: 'none',
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
      landlords: [],
      total: 0,
      source: 'none',
    });
  }
}
