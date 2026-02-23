import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  try {
    const result = await query(
      `SELECT id, destination_url FROM tracked_links WHERE code = $1 LIMIT 1`,
      [code]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }

    const link = result.rows[0];

    // Log click (fire-and-forget)
    const userAgent = request.headers.get('user-agent') || null;
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
    query(
      `INSERT INTO link_clicks (tracked_link_id, user_agent, ip_address) VALUES ($1, $2, $3)`,
      [link.id, userAgent, ip]
    ).catch(err => console.error('Failed to log click:', err));

    return NextResponse.redirect(link.destination_url, 302);
  } catch (error: any) {
    console.error('Click tracking error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
