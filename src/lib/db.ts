import { Pool, PoolClient, QueryResult } from 'pg';

// Strip sslmode from URL (we configure SSL separately to avoid self-signed cert errors)
const connectionString = (process.env.DATABASE_URL || '').replace(/[?&]sslmode=[^&]*/g, '');
const isRemote = connectionString.includes('ondigitalocean.com') || process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString,
  ssl: isRemote ? { rejectUnauthorized: false } : undefined,
  min: 0,
  max: 3,
  idleTimeoutMillis: 10000,
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
      contact_id INTEGER,
      type TEXT NOT NULL CHECK(type IN ('landlord', 'employer', 'university', 'residency', 'benefits-platform', 'graduate-housing')),
      stage TEXT NOT NULL DEFAULT 'lead' CHECK(stage IN ('lead', 'contacted', 'qualified', 'proposal', 'contract_sent', 'security_review', 'contract_signed', 'negotiation', 'closed')),
      value REAL DEFAULT 0,
      probability INTEGER DEFAULT 10,
      notes TEXT,
      next_action TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Add contact_id column to existing pipeline_deals tables
  await pool.query(`ALTER TABLE pipeline_deals ADD COLUMN IF NOT EXISTS contact_id INTEGER`).catch(() => {});

  // Expand type constraint for existing pipeline_deals tables
  await pool.query(`ALTER TABLE pipeline_deals DROP CONSTRAINT IF EXISTS pipeline_deals_type_check`).catch(() => {});
  await pool.query(`ALTER TABLE pipeline_deals ADD CONSTRAINT pipeline_deals_type_check CHECK(type IN ('landlord', 'employer', 'university', 'residency', 'benefits-platform', 'graduate-housing'))`).catch(() => {});

  // Expand stage constraint for existing pipeline_deals tables
  await pool.query(`ALTER TABLE pipeline_deals DROP CONSTRAINT IF EXISTS pipeline_deals_stage_check`).catch(() => {});
  await pool.query(`ALTER TABLE pipeline_deals ADD CONSTRAINT pipeline_deals_stage_check CHECK(stage IN ('lead', 'contacted', 'qualified', 'proposal', 'contract_sent', 'security_review', 'contract_signed', 'negotiation', 'closed'))`).catch(() => {});

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

  // Add referral tracking columns to contacts
  await pool.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS referred_by INTEGER`).catch(() => {});
  await pool.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS deal_id INTEGER`).catch(() => {});

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
    CREATE TABLE IF NOT EXISTS scheduled_emails (
      id SERIAL PRIMARY KEY,
      contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
      to_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      lead_id TEXT,
      lead_type TEXT,
      scheduled_for TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sent','failed','cancelled')),
      error TEXT,
      message_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      sent_at TIMESTAMPTZ
    )
  `);

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
      processed INTEGER DEFAULT 0,
      cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Add html_body column to existing scheduled_emails tables
  await pool.query(`ALTER TABLE scheduled_emails ADD COLUMN IF NOT EXISTS html_body TEXT`).catch(() => {});

  // Add processed column to existing inbox_cache tables
  await pool.query(`ALTER TABLE inbox_cache ADD COLUMN IF NOT EXISTS processed INTEGER DEFAULT 0`).catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS response_log (
      id SERIAL PRIMARY KEY,
      from_email TEXT NOT NULL,
      from_name TEXT,
      subject TEXT,
      body TEXT,
      classification TEXT NOT NULL,
      priority TEXT,
      contact_id INTEGER,
      deal_id INTEGER,
      action_taken TEXT,
      reply_scheduled_id INTEGER,
      processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tracked_links (
      id SERIAL PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      destination_url TEXT NOT NULL,
      contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
      scheduled_email_id INTEGER REFERENCES scheduled_emails(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS link_clicks (
      id SERIAL PRIMARY KEY,
      tracked_link_id INTEGER REFERENCES tracked_links(id) ON DELETE CASCADE,
      clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      user_agent TEXT,
      ip_address TEXT
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS listings (
      id SERIAL PRIMARY KEY,
      rentcast_id TEXT UNIQUE,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      zip_code TEXT,
      property_type TEXT,
      bedrooms INTEGER,
      bathrooms REAL,
      sqft INTEGER,
      listed_price REAL,
      days_on_market INTEGER,
      listed_date TEXT,
      listing_url TEXT,
      owner_name TEXT,
      owner_type TEXT,
      owner_phone TEXT,
      owner_email TEXT,
      estimated_vacancy_cost REAL,
      imported_to_contacts INTEGER DEFAULT 0,
      contact_id INTEGER REFERENCES contacts(id),
      source TEXT DEFAULT 'rentcast',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_listings_city_state ON listings(city, state)`).catch(() => {});
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_listings_dom ON listings(days_on_market)`).catch(() => {});

  // Add visual media + quality columns (idempotent)
  await pool.query(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS latitude REAL`).catch(() => {});
  await pool.query(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS longitude REAL`).catch(() => {});
  await pool.query(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS zillow_url TEXT`).catch(() => {});
  await pool.query(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS zillow_photos TEXT[]`).catch(() => {});
  await pool.query(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS street_view_url TEXT`).catch(() => {});
  await pool.query(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS quality_score INTEGER`).catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS contact_sequences (
      id SERIAL PRIMARY KEY,
      contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      contact_type TEXT NOT NULL,
      current_step INTEGER NOT NULL DEFAULT 1,
      max_steps INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused','completed','stopped')),
      last_sent_at TIMESTAMPTZ,
      next_send_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS meeting_bookings (
      id SERIAL PRIMARY KEY,
      calendly_event_id TEXT UNIQUE,
      attendee_name TEXT NOT NULL,
      attendee_email TEXT NOT NULL,
      event_type TEXT NOT NULL DEFAULT 'landlord',
      scheduled_at TIMESTAMPTZ NOT NULL,
      calendly_event_uri TEXT,
      tavus_conversation_id TEXT,
      tavus_conversation_url TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','completed','cancelled')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Add contact_id column to existing meeting_bookings tables
  await pool.query(`ALTER TABLE meeting_bookings ADD COLUMN IF NOT EXISTS contact_id INTEGER`).catch(() => {});

  // Add demo walkthrough columns to meeting_bookings
  await pool.query(`ALTER TABLE meeting_bookings ADD COLUMN IF NOT EXISTS qualification_data JSONB`).catch(() => {});
  await pool.query(`ALTER TABLE meeting_bookings ADD COLUMN IF NOT EXISTS demo_completed_at TIMESTAMPTZ`).catch(() => {});

  // Add Retell call_analysis JSONB to conversation_analytics
  await pool.query(`ALTER TABLE conversation_analytics ADD COLUMN IF NOT EXISTS call_analysis JSONB`).catch(() => {});

  // Add Retell AI phone call columns to meeting_bookings
  await pool.query(`ALTER TABLE meeting_bookings ADD COLUMN IF NOT EXISTS attendee_phone TEXT`).catch(() => {});
  await pool.query(`ALTER TABLE meeting_bookings ADD COLUMN IF NOT EXISTS retell_call_id TEXT`).catch(() => {});
  await pool.query(`ALTER TABLE meeting_bookings ADD COLUMN IF NOT EXISTS booking_source TEXT DEFAULT 'calendly'`).catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS conversation_analytics (
      id SERIAL PRIMARY KEY,
      conversation_id TEXT UNIQUE NOT NULL,
      booking_id INTEGER REFERENCES meeting_bookings(id) ON DELETE SET NULL,
      contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
      duration_seconds INTEGER,
      transcript TEXT,
      outcome TEXT CHECK(outcome IN ('interested','needs_followup','objection','not_interested','no_show','technical_issue')),
      sentiment TEXT,
      engagement_score REAL,
      key_topics TEXT,
      objections TEXT,
      next_steps TEXT,
      shutdown_reason TEXT,
      perception_data JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Tenant match jobs — tracks search requests from SweetLease
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tenant_match_jobs (
      id SERIAL PRIMARY KEY,
      sweetlease_match_request_id TEXT UNIQUE NOT NULL,
      tenant_email TEXT NOT NULL,
      tenant_name TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      budget_max REAL NOT NULL,
      budget_min REAL,
      bedrooms INTEGER NOT NULL,
      move_in_date TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','searching','matched','outreach_started','landlord_responded','completed','failed')),
      matched_listing_ids INTEGER[] DEFAULT '{}',
      matched_contact_ids INTEGER[] DEFAULT '{}',
      sequence_ids INTEGER[] DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_tmj_status ON tenant_match_jobs(status)`).catch(() => {});
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_tmj_city_state ON tenant_match_jobs(city, state)`).catch(() => {});

  // Add tenant-match to pipeline_deals type constraint
  await pool.query(`ALTER TABLE pipeline_deals DROP CONSTRAINT IF EXISTS pipeline_deals_type_check`).catch(() => {});
  await pool.query(`ALTER TABLE pipeline_deals ADD CONSTRAINT pipeline_deals_type_check CHECK(type IN ('landlord', 'employer', 'university', 'residency', 'benefits-platform', 'graduate-housing', 'tenant-match'))`).catch(() => {});

  // Indexes for fast lookups
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email)`).catch(() => {});
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_response_log_from_email ON response_log(from_email)`).catch(() => {});
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_tracked_links_code ON tracked_links(code)`).catch(() => {});
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_sequences_status_next ON contact_sequences(status, next_send_at)`).catch(() => {});
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_conv_analytics_booking ON conversation_analytics(booking_id)`).catch(() => {});
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_conv_analytics_contact ON conversation_analytics(contact_id)`).catch(() => {});
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_bookings_source_status ON meeting_bookings(booking_source, status)`).catch(() => {});
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_bookings_retell_call ON meeting_bookings(retell_call_id)`).catch(() => {});

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
