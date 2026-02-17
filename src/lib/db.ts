import { Pool, PoolClient, QueryResult } from 'pg';

// Strip sslmode from URL (we configure SSL separately to avoid self-signed cert errors)
const connectionString = (process.env.DATABASE_URL || '').replace(/[?&]sslmode=[^&]*/g, '');
const isRemote = connectionString.includes('ondigitalocean.com') || process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString,
  ssl: isRemote ? { rejectUnauthorized: false } : undefined,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

let initialized = false;

async function initTables() {
  if (initialized) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_log (
      id SERIAL PRIMARY KEY,
      to_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      lead_id TEXT,
      lead_type TEXT,
      message_id TEXT,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pipeline_deals (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      company TEXT,
      type TEXT NOT NULL CHECK(type IN ('landlord', 'employer')),
      stage TEXT NOT NULL DEFAULT 'lead' CHECK(stage IN ('lead', 'contacted', 'qualified', 'proposal', 'negotiation', 'closed')),
      value REAL DEFAULT 0,
      probability INTEGER DEFAULT 10,
      notes TEXT,
      next_action TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS activity_log (
      id SERIAL PRIMARY KEY,
      deal_id INTEGER REFERENCES pipeline_deals(id) ON DELETE CASCADE,
      activity_type TEXT NOT NULL,
      description TEXT NOT NULL,
      metadata TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS contacts (
      id SERIAL PRIMARY KEY,
      apollo_id TEXT UNIQUE,
      first_name TEXT,
      last_name TEXT,
      name TEXT NOT NULL,
      title TEXT,
      email TEXT,
      email_status TEXT,
      phone TEXT,
      linkedin_url TEXT,
      city TEXT,
      state TEXT,
      country TEXT,
      org_name TEXT,
      org_website TEXT,
      org_industry TEXT,
      org_employee_count INTEGER,
      org_city TEXT,
      org_state TEXT,
      source_template TEXT,
      contact_type TEXT,
      tags TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new', 'contacted', 'replied', 'qualified', 'disqualified')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Add contact_type column to existing contacts tables
  await pool.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS contact_type TEXT`).catch(() => {});

  // Backfill contact_type for existing contacts that don't have one
  await pool.query(`
    UPDATE contacts SET contact_type = CASE
      WHEN source_template = 'residency-coordinators' OR org_industry ILIKE '%hospital%' OR org_industry ILIKE '%health%' THEN 'residency'
      WHEN source_template = 'graduate-housing' OR org_industry ILIKE '%education%' OR org_industry ILIKE '%university%' THEN 'university'
      WHEN source_template = 'employer-relocation' OR source_template = 'benefits-platforms' THEN 'employer'
      WHEN org_industry ILIKE '%real estate%' OR source_template = 'landlord-contacts' THEN 'landlord'
      ELSE NULL
    END
    WHERE contact_type IS NULL
  `).catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS inbox_cache (
      id TEXT PRIMARY KEY,
      from_name TEXT,
      from_email TEXT,
      subject TEXT,
      preview TEXT,
      body TEXT,
      date TEXT,
      is_read INTEGER DEFAULT 0,
      is_starred INTEGER DEFAULT 0,
      has_replied INTEGER DEFAULT 0,
      classification TEXT,
      priority TEXT,
      cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  initialized = true;
}

export async function query(text: string, params?: any[]): Promise<QueryResult> {
  await initTables();
  return pool.query(text, params);
}

export async function getClient(): Promise<PoolClient> {
  await initTables();
  return pool.connect();
}
