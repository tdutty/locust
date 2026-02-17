import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const result = await query(`
      SELECT d.*,
        EXTRACT(DAY FROM NOW() - d.updated_at)::INTEGER as days_in_stage
      FROM pipeline_deals d
      ORDER BY d.updated_at DESC
    `);

    return NextResponse.json({ deals: result.rows });
  } catch (error: any) {
    console.error('Pipeline GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, company, type, stage, value, probability, notes, next_action } = body;

    if (!name || !type) {
      return NextResponse.json({ error: 'Name and type are required' }, { status: 400 });
    }

    const result = await query(`
      INSERT INTO pipeline_deals (name, company, type, stage, value, probability, notes, next_action)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `, [name, company || null, type, stage || 'lead', value || 0, probability || 10, notes || null, next_action || null]);

    const newId = result.rows[0].id;

    // Log activity
    await query(`
      INSERT INTO activity_log (deal_id, activity_type, description)
      VALUES ($1, 'created', 'Deal created')
    `, [newId]);

    const deal = await query('SELECT * FROM pipeline_deals WHERE id = $1', [newId]);
    return NextResponse.json({ deal: deal.rows[0] }, { status: 201 });
  } catch (error: any) {
    console.error('Pipeline POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, stage, value, probability, notes, next_action } = body;

    if (!id) {
      return NextResponse.json({ error: 'Deal ID is required' }, { status: 400 });
    }

    const existing = await query('SELECT * FROM pipeline_deals WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    if (stage !== undefined) { updates.push(`stage = $${paramIdx++}`); values.push(stage); }
    if (value !== undefined) { updates.push(`value = $${paramIdx++}`); values.push(value); }
    if (probability !== undefined) { updates.push(`probability = $${paramIdx++}`); values.push(probability); }
    if (notes !== undefined) { updates.push(`notes = $${paramIdx++}`); values.push(notes); }
    if (next_action !== undefined) { updates.push(`next_action = $${paramIdx++}`); values.push(next_action); }

    updates.push('updated_at = NOW()');
    values.push(id);

    await query(`UPDATE pipeline_deals SET ${updates.join(', ')} WHERE id = $${paramIdx}`, values);

    // Log stage change
    if (stage && stage !== existing.rows[0].stage) {
      await query(`
        INSERT INTO activity_log (deal_id, activity_type, description, metadata)
        VALUES ($1, 'stage_change', $2, $3)
      `, [id, `Moved from ${existing.rows[0].stage} to ${stage}`, JSON.stringify({ from: existing.rows[0].stage, to: stage })]);
    }

    const deal = await query('SELECT * FROM pipeline_deals WHERE id = $1', [id]);
    return NextResponse.json({ deal: deal.rows[0] });
  } catch (error: any) {
    console.error('Pipeline PATCH error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
