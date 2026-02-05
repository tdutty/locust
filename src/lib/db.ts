import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'locust.db');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function saveDb(db: SqlJsDatabase) {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

// Wrapper that provides a better-sqlite3-compatible API over sql.js
class DatabaseWrapper {
  private db: SqlJsDatabase;
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(db: SqlJsDatabase) {
    this.db = db;
  }

  private scheduleSave() {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      saveDb(this.db);
      this.saveTimeout = null;
    }, 100);
  }

  exec(sql: string) {
    this.db.run(sql);
    this.scheduleSave();
  }

  prepare(sql: string) {
    const db = this.db;
    const wrapper = this;
    return {
      run(...params: any[]) {
        db.run(sql, params);
        wrapper.scheduleSave();
        return { changes: db.getRowsModified(), lastInsertRowid: getLastInsertRowid(db) };
      },
      all(...params: any[]): any[] {
        const stmt = db.prepare(sql);
        if (params.length > 0) stmt.bind(params);
        const rows: any[] = [];
        while (stmt.step()) {
          rows.push(stmt.getAsObject());
        }
        stmt.free();
        return rows;
      },
      get(...params: any[]): any {
        const stmt = db.prepare(sql);
        if (params.length > 0) stmt.bind(params);
        let row = null;
        if (stmt.step()) {
          row = stmt.getAsObject();
        }
        stmt.free();
        return row;
      },
    };
  }
}

function getLastInsertRowid(db: SqlJsDatabase): number {
  const stmt = db.prepare('SELECT last_insert_rowid() as id');
  stmt.step();
  const result = stmt.getAsObject() as { id: number };
  stmt.free();
  return result.id;
}

let _dbPromise: Promise<DatabaseWrapper> | null = null;

export async function getDb(): Promise<DatabaseWrapper> {
  if (_dbPromise) return _dbPromise;

  _dbPromise = (async () => {
    ensureDataDir();

    const SQL = await initSqlJs();

    let db: SqlJsDatabase;
    if (fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }

    const wrapper = new DatabaseWrapper(db);
    initTables(wrapper);
    return wrapper;
  })();

  return _dbPromise;
}

function initTables(db: DatabaseWrapper) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      to_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      lead_id TEXT,
      lead_type TEXT,
      message_id TEXT,
      sent_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS pipeline_deals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      company TEXT,
      type TEXT NOT NULL CHECK(type IN ('landlord', 'employer')),
      stage TEXT NOT NULL DEFAULT 'lead' CHECK(stage IN ('lead', 'contacted', 'qualified', 'proposal', 'negotiation', 'closed')),
      value REAL DEFAULT 0,
      probability INTEGER DEFAULT 10,
      notes TEXT,
      next_action TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deal_id INTEGER REFERENCES pipeline_deals(id) ON DELETE CASCADE,
      activity_type TEXT NOT NULL,
      description TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.exec(`
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
      cached_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}
