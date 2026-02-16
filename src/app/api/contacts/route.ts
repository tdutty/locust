import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

/**
 * GET /api/contacts — Retrieve saved contacts from the database
 */
export async function GET(req: NextRequest) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(req.url);

    const status = searchParams.get('status');
    const template = searchParams.get('template');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const perPage = parseInt(searchParams.get('perPage') || '50');

    let where: string[] = [];
    let params: any[] = [];

    if (status) {
      where.push('status = ?');
      params.push(status);
    }
    if (template) {
      where.push('source_template = ?');
      params.push(template);
    }
    if (search) {
      where.push('(name LIKE ? OR email LIKE ? OR org_name LIKE ? OR title LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    // Get total count
    const countRow = db.prepare(`SELECT COUNT(*) as total FROM contacts ${whereClause}`).get(...params) as any;
    const total = countRow?.total || 0;

    // Get paginated results
    const offset = (page - 1) * perPage;
    const contacts = db.prepare(
      `SELECT * FROM contacts ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).all(...params, perPage, offset);

    return NextResponse.json({
      contacts,
      pagination: {
        page,
        perPage,
        totalEntries: total,
        totalPages: Math.ceil(total / perPage),
      },
    });
  } catch (error: any) {
    console.error('[Contacts GET Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/contacts — Save one or more contacts to the database
 * Body: { contacts: Contact[] } where Contact matches the Apollo format
 */
export async function POST(req: NextRequest) {
  try {
    const db = await getDb();
    const body = await req.json();
    const { contacts } = body;

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json({ error: 'contacts array is required' }, { status: 400 });
    }

    let saved = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const contact of contacts) {
      try {
        // Check if already saved (by apollo_id)
        if (contact.id) {
          const existing = db.prepare('SELECT id FROM contacts WHERE apollo_id = ?').get(contact.id);
          if (existing) {
            skipped++;
            continue;
          }
        }

        db.prepare(`
          INSERT INTO contacts (
            apollo_id, first_name, last_name, name, title, email, email_status,
            phone, linkedin_url, city, state, country,
            org_name, org_website, org_industry, org_employee_count, org_city, org_state,
            source_template, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')
        `).run(
          contact.id || null,
          contact.firstName || null,
          contact.lastName || null,
          contact.name || `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
          contact.title || null,
          contact.email || null,
          contact.emailStatus || null,
          contact.phone || null,
          contact.linkedinUrl || null,
          contact.city || null,
          contact.state || null,
          contact.country || null,
          contact.organization?.name || null,
          contact.organization?.website || null,
          contact.organization?.industry || null,
          contact.organization?.employeeCount || null,
          contact.organization?.city || null,
          contact.organization?.state || null,
          contact.sourceTemplate || null,
        );
        saved++;
      } catch (err: any) {
        errors.push(`${contact.name}: ${err.message}`);
      }
    }

    return NextResponse.json({
      saved,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
      message: `Saved ${saved} contact${saved !== 1 ? 's' : ''}${skipped > 0 ? `, ${skipped} already existed` : ''}`,
    }, { status: 201 });
  } catch (error: any) {
    console.error('[Contacts POST Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PATCH /api/contacts — Update a contact's status, notes, or tags
 */
export async function PATCH(req: NextRequest) {
  try {
    const db = await getDb();
    const body = await req.json();
    const { id, status, notes, tags } = body;

    if (!id) {
      return NextResponse.json({ error: 'Contact ID is required' }, { status: 400 });
    }

    const existing = db.prepare('SELECT * FROM contacts WHERE id = ?').get(id);
    if (!existing) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (status !== undefined) { updates.push('status = ?'); values.push(status); }
    if (notes !== undefined) { updates.push('notes = ?'); values.push(notes); }
    if (tags !== undefined) { updates.push('tags = ?'); values.push(tags); }

    updates.push("updated_at = datetime('now')");
    values.push(id);

    db.prepare(`UPDATE contacts SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(id);
    return NextResponse.json({ contact });
  } catch (error: any) {
    console.error('[Contacts PATCH Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/contacts — Remove contacts by IDs
 */
export async function DELETE(req: NextRequest) {
  try {
    const db = await getDb();
    const body = await req.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids array is required' }, { status: 400 });
    }

    const placeholders = ids.map(() => '?').join(',');
    db.prepare(`DELETE FROM contacts WHERE id IN (${placeholders})`).run(...ids);

    return NextResponse.json({ deleted: ids.length });
  } catch (error: any) {
    console.error('[Contacts DELETE Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
