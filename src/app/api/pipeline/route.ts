import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    const deals = db.prepare(`
      SELECT d.*,
        CAST((julianday('now') - julianday(d.updated_at)) AS INTEGER) as days_in_stage
      FROM pipeline_deals d
      ORDER BY d.updated_at DESC
    `).all();

    return NextResponse.json({ deals });
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

    const db = getDb();
    const result = db.prepare(`
      INSERT INTO pipeline_deals (name, company, type, stage, value, probability, notes, next_action)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name,
      company || null,
      type,
      stage || 'lead',
      value || 0,
      probability || 10,
      notes || null,
      next_action || null
    );

    // Log activity
    db.prepare(`
      INSERT INTO activity_log (deal_id, activity_type, description)
      VALUES (?, 'created', 'Deal created')
    `).run(result.lastInsertRowid);

    const deal = db.prepare('SELECT * FROM pipeline_deals WHERE id = ?').get(result.lastInsertRowid);
    return NextResponse.json({ deal }, { status: 201 });
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

    const db = getDb();
    const existing = db.prepare('SELECT * FROM pipeline_deals WHERE id = ?').get(id) as any;
    if (!existing) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (stage !== undefined) { updates.push('stage = ?'); values.push(stage); }
    if (value !== undefined) { updates.push('value = ?'); values.push(value); }
    if (probability !== undefined) { updates.push('probability = ?'); values.push(probability); }
    if (notes !== undefined) { updates.push('notes = ?'); values.push(notes); }
    if (next_action !== undefined) { updates.push('next_action = ?'); values.push(next_action); }

    updates.push("updated_at = datetime('now')");
    values.push(id);

    db.prepare(`UPDATE pipeline_deals SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    // Log stage change
    if (stage && stage !== existing.stage) {
      db.prepare(`
        INSERT INTO activity_log (deal_id, activity_type, description, metadata)
        VALUES (?, 'stage_change', ?, ?)
      `).run(id, `Moved from ${existing.stage} to ${stage}`, JSON.stringify({ from: existing.stage, to: stage }));
    }

    const deal = db.prepare('SELECT * FROM pipeline_deals WHERE id = ?').get(id);
    return NextResponse.json({ deal });
  } catch (error: any) {
    console.error('Pipeline PATCH error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
