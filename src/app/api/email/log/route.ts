import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const leadType = searchParams.get('lead_type');

    const db = await getDb();
    let query = 'SELECT * FROM email_log';
    const params: any[] = [];

    if (leadType) {
      query += ' WHERE lead_type = ?';
      params.push(leadType);
    }

    query += ' ORDER BY sent_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const emails = db.prepare(query).all(...params);
    const total = db.prepare(
      `SELECT COUNT(*) as count FROM email_log${leadType ? ' WHERE lead_type = ?' : ''}`
    ).get(...(leadType ? [leadType] : [])) as { count: number };

    return NextResponse.json({ emails, total: total.count });
  } catch (error: any) {
    console.error('Email log GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, subject, body: emailBody, leadId, leadType, messageId } = body;

    if (!to || !subject) {
      return NextResponse.json({ error: 'To and subject are required' }, { status: 400 });
    }

    const db = await getDb();
    const result = db.prepare(`
      INSERT INTO email_log (to_email, subject, body, lead_id, lead_type, message_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(to, subject, emailBody || '', leadId || null, leadType || null, messageId || null);

    return NextResponse.json({ id: result.lastInsertRowid, success: true }, { status: 201 });
  } catch (error: any) {
    console.error('Email log POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
