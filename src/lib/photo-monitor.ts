/**
 * Photo download monitoring — tracks success rates, failures,
 * blocked requests, and alerts on issues.
 */

import { query } from '@/lib/db';

interface PhotoStats {
  // Current state
  totalListings: number;
  withZillowPhotos: number;
  withS3Photos: number;
  pendingDownload: number;
  totalZillowPhotos: number;
  totalS3Photos: number;
  percentComplete: number;

  // Rate tracking (last hour)
  downloadedLastHour: number;
  failedLastHour: number;
  successRate: number;

  // Rate tracking (last 24h)
  downloadedLast24h: number;
  failedLast24h: number;

  // Estimated completion
  estimatedHoursRemaining: number | null;

  // Health
  status: 'healthy' | 'degraded' | 'blocked' | 'idle';
  issues: string[];
}

/**
 * Get comprehensive photo download stats.
 */
export async function getPhotoMonitorStats(): Promise<PhotoStats> {
  // Ensure monitoring table exists
  await query(`
    CREATE TABLE IF NOT EXISTS photo_download_log (
      id SERIAL PRIMARY KEY,
      listing_id INT,
      photo_url TEXT,
      s3_url TEXT,
      status TEXT NOT NULL,
      error TEXT,
      bytes INT,
      duration_ms INT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {});

  // Basic counts
  const counts = await query(`
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN zillow_photos IS NOT NULL AND array_length(zillow_photos, 1) > 0 THEN 1 END) as with_zillow,
      COUNT(CASE WHEN s3_photos IS NOT NULL AND array_length(s3_photos, 1) > 0 THEN 1 END) as with_s3,
      SUM(COALESCE(array_length(zillow_photos, 1), 0)) as total_zillow,
      SUM(COALESCE(array_length(s3_photos, 1), 0)) as total_s3
    FROM listings
  `);

  const c = counts.rows[0];
  const totalListings = parseInt(c.total);
  const withZillow = parseInt(c.with_zillow);
  const withS3 = parseInt(c.with_s3);
  const totalZillow = parseInt(c.total_zillow) || 0;
  const totalS3 = parseInt(c.total_s3) || 0;
  const pending = withZillow - withS3;
  const pct = withZillow > 0 ? Math.round((withS3 / withZillow) * 100) : 0;

  // Last hour stats from log
  const hourStats = await query(`
    SELECT
      COUNT(CASE WHEN status = 'success' THEN 1 END) as success,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
      COUNT(CASE WHEN status = 'blocked' THEN 1 END) as blocked,
      COUNT(CASE WHEN status = 'timeout' THEN 1 END) as timeout
    FROM photo_download_log
    WHERE created_at > NOW() - INTERVAL '1 hour'
  `).catch(() => ({ rows: [{ success: '0', failed: '0', blocked: '0', timeout: '0' }] }));

  const h = hourStats.rows[0];
  const dlLastHour = parseInt(h.success) || 0;
  const failLastHour = (parseInt(h.failed) || 0) + (parseInt(h.blocked) || 0) + (parseInt(h.timeout) || 0);
  const totalLastHour = dlLastHour + failLastHour;
  const successRate = totalLastHour > 0 ? Math.round((dlLastHour / totalLastHour) * 100) : 100;

  // Last 24h
  const dayStats = await query(`
    SELECT
      COUNT(CASE WHEN status = 'success' THEN 1 END) as success,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
    FROM photo_download_log
    WHERE created_at > NOW() - INTERVAL '24 hours'
  `).catch(() => ({ rows: [{ success: '0', failed: '0' }] }));

  const d = dayStats.rows[0];
  const dlLast24h = parseInt(d.success) || 0;
  const failLast24h = parseInt(d.failed) || 0;

  // Estimated completion
  let estHours: number | null = null;
  if (dlLastHour > 0 && pending > 0) {
    // Photos per hour rate × average photos per listing
    const avgPhotosPerListing = withS3 > 0 ? totalS3 / withS3 : 5;
    const listingsPerHour = dlLastHour / avgPhotosPerListing;
    estHours = listingsPerHour > 0 ? Math.round(pending / listingsPerHour) : null;
  }

  // Health assessment
  const issues: string[] = [];
  let status: 'healthy' | 'degraded' | 'blocked' | 'idle' = 'healthy';

  if (totalLastHour === 0 && pending > 0) {
    status = 'idle';
    issues.push('No downloads in the last hour — cron may not be running');
  } else if (successRate < 50) {
    status = 'blocked';
    issues.push(`Success rate dropped to ${successRate}% — Zillow may be blocking requests`);
  } else if (successRate < 80) {
    status = 'degraded';
    issues.push(`Success rate at ${successRate}% — some requests are failing`);
  }

  if (parseInt(h.blocked) > 5) {
    issues.push(`${h.blocked} requests blocked in the last hour — consider pausing downloads`);
  }

  if (parseInt(h.timeout) > 10) {
    issues.push(`${h.timeout} timeouts in the last hour — network may be slow`);
  }

  if (pending === 0 && withZillow > 0) {
    status = 'idle';
    issues.push('All photos downloaded — nothing left to process');
  }

  return {
    totalListings,
    withZillowPhotos: withZillow,
    withS3Photos: withS3,
    pendingDownload: pending,
    totalZillowPhotos: totalZillow,
    totalS3Photos: totalS3,
    percentComplete: pct,
    downloadedLastHour: dlLastHour,
    failedLastHour: failLastHour,
    successRate,
    downloadedLast24h: dlLast24h,
    failedLast24h: failLast24h,
    estimatedHoursRemaining: estHours,
    status,
    issues,
  };
}
