import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// POST — Create a scheduled email
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, subject, body: emailBody, scheduledFor, contactId, leadId, leadType } = body;

    if (!to || !subject || !emailBody || !scheduledFor) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject, body, scheduledFor' },
        { status: 400 }
      );
    }

    const scheduledDate = new Date(scheduledFor);
    if (isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
      return NextResponse.json(
        { error: 'scheduledFor must be a valid future date' },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO scheduled_emails (contact_id, to_email, subject, body, lead_id, lead_type, scheduled_for)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, scheduled_for`,
      [contactId || null, to, subject, emailBody, leadId || null, leadType || null, scheduledDate.toISOString()]
    );

    return NextResponse.json({
      success: true,
      id: result.rows[0].id,
      scheduledFor: result.rows[0].scheduled_for,
    });
  } catch (error: any) {
    console.error('Schedule email error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to schedule email' },
      { status: 500 }
    );
  }
}

// GET — List scheduled emails
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const perPage = parseInt(searchParams.get('perPage') || '50');
    const offset = (page - 1) * perPage;

    let whereClause = '';
    const params: any[] = [];

    if (status) {
      params.push(status);
      whereClause = `WHERE se.status = $${params.length}`;
    }

    const countResult = await query(
      `SELECT COUNT(*) as total FROM scheduled_emails se ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    const queryParams = [...params, perPage, offset];
    const result = await query(
      `SELECT se.*, c.name as contact_name
       FROM scheduled_emails se
       LEFT JOIN contacts c ON se.contact_id = c.id
       ${whereClause}
       ORDER BY se.scheduled_for ASC
       LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`,
      queryParams
    );

    return NextResponse.json({
      emails: result.rows,
      pagination: {
        page,
        perPage,
        totalEntries: total,
        totalPages: Math.ceil(total / perPage),
      },
    });
  } catch (error: any) {
    console.error('List scheduled emails error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to list scheduled emails' },
      { status: 500 }
    );
  }
}

// PATCH — Cancel a scheduled email
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Missing required field: id' },
        { status: 400 }
      );
    }

    const result = await query(
      `UPDATE scheduled_emails SET status = 'cancelled' WHERE id = $1 AND status = 'pending' RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Scheduled email not found or already processed' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, id: result.rows[0].id });
  } catch (error: any) {
    console.error('Cancel scheduled email error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to cancel scheduled email' },
      { status: 500 }
    );
  }
}
