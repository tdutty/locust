import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const result = await query('SELECT key, value FROM settings');

    const settings: Record<string, string> = {};
    for (const row of result.rows) {
      settings[row.key] = row.value;
    }

    // Include env var status for SMTP/IMAP (read-only)
    settings['_smtp_configured'] = process.env.SMTP_USER ? 'true' : 'false';
    settings['_imap_configured'] = process.env.SMTP_USER ? 'true' : 'false';
    settings['_anthropic_configured'] = process.env.ANTHROPIC_API_KEY ? 'true' : 'false';
    settings['_smtp_user'] = process.env.SMTP_USER || '';

    return NextResponse.json({ settings });
  } catch (error: any) {
    console.error('Settings GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { settings } = body;

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json({ error: 'Settings object is required' }, { status: 400 });
    }

    for (const [key, value] of Object.entries(settings) as [string, string][]) {
      // Don't allow writing system keys
      if (key.startsWith('_')) continue;
      await query(`
        INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW())
        ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
      `, [key, value]);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Settings POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
