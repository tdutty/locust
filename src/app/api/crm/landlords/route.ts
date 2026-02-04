import { NextRequest, NextResponse } from 'next/server';

const GRASSHOPPER_API_URL = process.env.GRASSHOPPER_API_URL || 'http://198.199.78.62:8080';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const city = searchParams.get('city');
    const status = searchParams.get('status');
    const minProperties = searchParams.get('minProperties');
    const limit = searchParams.get('limit') || '50';
    const offset = searchParams.get('offset') || '0';

    // Build query parameters for Grasshopper API
    const params = new URLSearchParams();
    if (city) params.append('city', city);
    if (status) params.append('status', status);
    if (minProperties) params.append('minProperties', minProperties);
    params.append('limit', limit);
    params.append('offset', offset);

    // Fetch from Grasshopper CRM
    const response = await fetch(`${GRASSHOPPER_API_URL}/api/landlords?${params.toString()}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      // If Grasshopper is unavailable, return sample data
      return NextResponse.json({
        landlords: getSampleLandlords(),
        total: 166,
        source: 'sample',
      });
    }

    const data = await response.json();
    return NextResponse.json({
      ...data,
      source: 'grasshopper',
    });
  } catch (error) {
    console.error('Error fetching landlords:', error);
    // Return sample data on error
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
