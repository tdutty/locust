import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const leadType = searchParams.get('lead_type');

    let sql = 'SELECT * FROM email_log';
    const params: any[] = [];
    let paramIdx = 1;

    if (leadType) {
      sql += ` WHERE lead_type = $${paramIdx++}`;
      params.push(leadType);
    }

    sql += ` ORDER BY sent_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    params.push(limit, offset);

    const emails = await query(sql, params);

    let countSql = 'SELECT COUNT(*) as count FROM email_log';
    const countParams: any[] = [];
    if (leadType) {
      countSql += ' WHERE lead_type = $1';
      countParams.push(leadType);
    }
    const total = await query(countSql, countParams);

    return NextResponse.json({ emails: emails.rows, total: parseInt(total.rows[0].count) });
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

    const result = await query(`
      INSERT INTO email_log (to_email, subject, body, lead_id, lead_type, message_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [to, subject, emailBody || '', leadId || null, leadType || null, messageId || null]);

    return NextResponse.json({ id: result.rows[0].id, success: true }, { status: 201 });
  } catch (error: any) {
    console.error('Email log POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
