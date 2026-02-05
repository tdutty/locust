import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = await getDb();
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];

    const settings: Record<string, string> = {};
    for (const row of rows) {
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

    const db = await getDb();

    for (const [key, value] of Object.entries(settings) as [string, string][]) {
      // Don't allow writing system keys
      if (key.startsWith('_')) continue;
      db.prepare(`
        INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
      `).run(key, value);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Settings POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
