/**
 * Batch city scanner — scans multiple cities sequentially with
 * full progress tracking, error logging, and resume capability.
 */

import { query } from '@/lib/db';
import { scanCity } from '@/lib/city-scan';

export interface BatchCity {
  city: string;
  state: string;
  notes?: string;
}

export interface BatchProgress {
  batchId: string;
  totalCities: number;
  completed: number;
  failed: number;
  inProgress: string | null;
  creditsUsed: number;
  startedAt: string;
  results: Array<{
    city: string;
    state: string;
    status: 'completed' | 'failed' | 'pending';
    listings?: number;
    buildings?: number;
    enriched?: number;
    credits?: number;
    error?: string;
    duration?: number;
  }>;
}

/**
 * Run a batch scan of multiple cities.
 * Saves progress to DB so it can be monitored and resumed.
 */
export async function runBatchScan(
  batchId: string,
  cities: BatchCity[],
): Promise<BatchProgress> {
  // Create batch tracking table
  await query(`
    CREATE TABLE IF NOT EXISTS batch_scans (
      id TEXT PRIMARY KEY,
      total_cities INT,
      completed INT DEFAULT 0,
      failed INT DEFAULT 0,
      credits_used INT DEFAULT 0,
      status TEXT DEFAULT 'running',
      started_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {});

  await query(`
    CREATE TABLE IF NOT EXISTS batch_scan_cities (
      id SERIAL PRIMARY KEY,
      batch_id TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      notes TEXT,
      status TEXT DEFAULT 'pending',
      listings INT,
      buildings INT,
      enriched INT,
      credits INT,
      error TEXT,
      duration_ms INT,
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      UNIQUE(batch_id, city, state)
    )
  `).catch(() => {});

  // Insert batch record
  await query(
    `INSERT INTO batch_scans (id, total_cities, status) VALUES ($1, $2, 'running')
     ON CONFLICT (id) DO UPDATE SET total_cities = $2, status = 'running', started_at = NOW(), completed = 0, failed = 0, credits_used = 0`,
    [batchId, cities.length]
  );

  // Insert city records
  for (const c of cities) {
    await query(
      `INSERT INTO batch_scan_cities (batch_id, city, state, notes, status)
       VALUES ($1, $2, $3, $4, 'pending')
       ON CONFLICT (batch_id, city, state) DO UPDATE SET status = 'pending', error = NULL`,
      [batchId, c.city, c.state, c.notes || null]
    );
  }

  let totalCompleted = 0;
  let totalFailed = 0;
  let totalCredits = 0;

  for (let i = 0; i < cities.length; i++) {
    const c = cities[i];
    const startTime = Date.now();

    console.log(`[batch-scan] [${i + 1}/${cities.length}] Scanning ${c.city}, ${c.state}...`);

    // Update status to in_progress
    await query(
      `UPDATE batch_scan_cities SET status = 'scanning', started_at = NOW() WHERE batch_id = $1 AND city = $2 AND state = $3`,
      [batchId, c.city, c.state]
    );
    await query(
      `UPDATE batch_scans SET updated_at = NOW() WHERE id = $1`,
      [batchId]
    );

    try {
      const result = await scanCity(c.city, c.state, 1);
      const duration = Date.now() - startTime;

      await query(
        `UPDATE batch_scan_cities SET
           status = 'completed', listings = $1, buildings = $2, enriched = $3,
           credits = $4, duration_ms = $5, completed_at = NOW()
         WHERE batch_id = $6 AND city = $7 AND state = $8`,
        [result.totalListingsScraped, result.uniqueBuildings, result.enrichedCount,
         result.creditsUsed, duration, batchId, c.city, c.state]
      );

      totalCompleted++;
      totalCredits += result.creditsUsed;

      await query(
        `UPDATE batch_scans SET completed = $1, credits_used = $2, updated_at = NOW() WHERE id = $3`,
        [totalCompleted, totalCredits, batchId]
      );

      console.log(`[batch-scan] [${i + 1}/${cities.length}] ${c.city}, ${c.state} ✓ — ${result.totalListingsScraped} listings, ${result.enrichedCount} enriched (${Math.round(duration / 1000)}s)`);

      // Rate limit between cities — 3 second pause
      if (i < cities.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    } catch (err: any) {
      const duration = Date.now() - startTime;
      const errorMsg = err.message || 'Unknown error';

      await query(
        `UPDATE batch_scan_cities SET status = 'failed', error = $1, duration_ms = $2, completed_at = NOW()
         WHERE batch_id = $3 AND city = $4 AND state = $5`,
        [errorMsg, duration, batchId, c.city, c.state]
      );

      totalFailed++;
      await query(
        `UPDATE batch_scans SET failed = $1, updated_at = NOW() WHERE id = $2`,
        [totalFailed, batchId]
      );

      console.error(`[batch-scan] [${i + 1}/${cities.length}] ${c.city}, ${c.state} ✗ — ${errorMsg} (${Math.round(duration / 1000)}s)`);

      // Continue to next city — don't stop the batch
    }
  }

  // Mark batch complete
  await query(
    `UPDATE batch_scans SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = $1`,
    [batchId]
  );

  console.log(`[batch-scan] Batch ${batchId} complete: ${totalCompleted} succeeded, ${totalFailed} failed, ${totalCredits} credits used`);

  return getBatchProgress(batchId);
}

/**
 * Get current progress of a batch scan.
 */
export async function getBatchProgress(batchId: string): Promise<BatchProgress> {
  const batch = await query(`SELECT * FROM batch_scans WHERE id = $1`, [batchId]);
  const cities = await query(
    `SELECT * FROM batch_scan_cities WHERE batch_id = $1 ORDER BY id`,
    [batchId]
  );

  const b = batch.rows[0] || {};
  const scanning = cities.rows.find((c: any) => c.status === 'scanning');

  return {
    batchId,
    totalCities: b.total_cities || 0,
    completed: b.completed || 0,
    failed: b.failed || 0,
    inProgress: scanning ? `${scanning.city}, ${scanning.state}` : null,
    creditsUsed: b.credits_used || 0,
    startedAt: b.started_at || '',
    results: cities.rows.map((c: any) => ({
      city: c.city,
      state: c.state,
      status: c.status,
      listings: c.listings,
      buildings: c.buildings,
      enriched: c.enriched,
      credits: c.credits,
      error: c.error,
      duration: c.duration_ms,
    })),
  };
}
