/**
 * Photo Downloader — transfers listing photos from Zillow to our S3 bucket.
 * Runs in batches to avoid overwhelming Zillow or our storage.
 *
 * Downloads images via randomized user agents with delays between requests.
 * Stores in DO Spaces under listings/{city-state}/{zpid}/{index}.webp
 */

import { query } from '@/lib/db';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  endpoint: process.env.DO_SPACES_ENDPOINT || 'https://nyc3.digitaloceanspaces.com',
  region: process.env.DO_SPACES_REGION || 'nyc3',
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY || '',
    secretAccessKey: process.env.DO_SPACES_SECRET || '',
  },
  forcePathStyle: false,
});

const BUCKET = process.env.DO_SPACES_BUCKET || 'sweetlease-storage-development';
const CDN_BASE = process.env.DO_SPACES_CDN_URL || `https://${BUCKET}.nyc3.cdn.digitaloceanspaces.com`;

const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
];

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms + Math.random() * 500));
}

interface DownloadResult {
  processed: number;
  downloaded: number;
  failed: number;
  skipped: number;
}

/**
 * Download photos for a batch of listings from Zillow to S3.
 * Processes listings that have zillow_photos but no s3_photos.
 */
export async function downloadPhotoBatch(batchSize: number = 20): Promise<DownloadResult> {
  // Ensure s3_photos column exists
  await query(`
    ALTER TABLE listings ADD COLUMN IF NOT EXISTS s3_photos TEXT[] DEFAULT '{}'
  `).catch(() => {});

  // Find listings with Zillow photos but no S3 photos
  const listings = await query(
    `SELECT id, rentcast_id, address, city, state, zillow_photos
     FROM listings
     WHERE zillow_photos IS NOT NULL
       AND array_length(zillow_photos, 1) > 0
       AND (s3_photos IS NULL OR array_length(s3_photos, 1) = 0 OR s3_photos = '{}')
     ORDER BY quality_score DESC NULLS LAST
     LIMIT $1`,
    [batchSize]
  );

  let downloaded = 0;
  let failed = 0;
  let skipped = 0;

  for (const listing of listings.rows) {
    const photos: string[] = listing.zillow_photos || [];
    const s3Urls: string[] = [];
    const citySlug = (listing.city || 'unknown').toLowerCase().replace(/\s+/g, '-');
    const stateSlug = (listing.state || 'unknown').toLowerCase();
    const zpid = listing.rentcast_id?.replace('zillow-', '') || listing.id;

    for (let i = 0; i < photos.length; i++) {
      const zillowUrl = photos[i];
      if (!zillowUrl || !zillowUrl.startsWith('http')) {
        skipped++;
        continue;
      }

      const s3Key = `listings/${citySlug}-${stateSlug}/${zpid}/${i}.webp`;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        const res = await fetch(zillowUrl, {
          headers: {
            'User-Agent': randomUA(),
            'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
            'Referer': 'https://www.zillow.com/',
          },
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) {
          const isBlocked = res.status === 403 || res.status === 429;
          await query(
            `INSERT INTO photo_download_log (listing_id, photo_url, status, error) VALUES ($1, $2, $3, $4)`,
            [listing.id, zillowUrl, isBlocked ? 'blocked' : 'failed', `HTTP ${res.status}`]
          ).catch(() => {});
          failed++;
          if (isBlocked) {
            console.warn(`[photo-dl] Blocked by Zillow (${res.status}) — pausing this listing`);
            await delay(5000 + Math.random() * 5000); // Extra long delay on block
          }
          continue;
        }

        const buffer = Buffer.from(await res.arrayBuffer());

        // Skip tiny/broken images
        if (buffer.length < 3000) {
          skipped++;
          continue;
        }

        // Upload to S3
        const startTime = Date.now();
        await s3Client.send(new PutObjectCommand({
          Bucket: BUCKET,
          Key: s3Key,
          Body: buffer,
          ContentType: 'image/webp',
          ACL: 'public-read',
          CacheControl: 'public, max-age=31536000',
        }));

        const cdnUrl = `${CDN_BASE}/${s3Key}`;
        s3Urls.push(cdnUrl);
        downloaded++;

        // Log success
        await query(
          `INSERT INTO photo_download_log (listing_id, photo_url, s3_url, status, bytes, duration_ms) VALUES ($1, $2, $3, 'success', $4, $5)`,
          [listing.id, zillowUrl, cdnUrl, buffer.length, Date.now() - startTime]
        ).catch(() => {});

        // Random delay between images (500ms-2s)
        await delay(500 + Math.random() * 1500);
      } catch (err: any) {
        const status = err.name === 'AbortError' ? 'timeout' : 'failed';
        if (err.name === 'AbortError') {
          console.warn(`[photo-dl] Timeout downloading ${zillowUrl}`);
        }
        failed++;

        // Log failure
        await query(
          `INSERT INTO photo_download_log (listing_id, photo_url, status, error) VALUES ($1, $2, $3, $4)`,
          [listing.id, zillowUrl, status, err.message?.slice(0, 200)]
        ).catch(() => {});
      }
    }

    // Update listing with S3 URLs
    if (s3Urls.length > 0) {
      await query(
        `UPDATE listings SET s3_photos = $1, updated_at = NOW() WHERE id = $2`,
        [s3Urls, listing.id]
      );
    }

    // Delay between listings (1-3s)
    await delay(1000 + Math.random() * 2000);
  }

  console.log(`[photo-dl] Batch complete: ${downloaded} downloaded, ${failed} failed, ${skipped} skipped from ${listings.rows.length} listings`);

  return {
    processed: listings.rows.length,
    downloaded,
    failed,
    skipped,
  };
}

/**
 * Get download progress stats.
 */
export async function getDownloadProgress(): Promise<{
  totalListings: number;
  withZillowPhotos: number;
  withS3Photos: number;
  pendingDownload: number;
  totalZillowPhotos: number;
  totalS3Photos: number;
}> {
  const stats = await query(`
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN zillow_photos IS NOT NULL AND array_length(zillow_photos, 1) > 0 THEN 1 END) as with_zillow,
      COUNT(CASE WHEN s3_photos IS NOT NULL AND array_length(s3_photos, 1) > 0 THEN 1 END) as with_s3,
      SUM(COALESCE(array_length(zillow_photos, 1), 0)) as total_zillow_photos,
      SUM(COALESCE(array_length(s3_photos, 1), 0)) as total_s3_photos
    FROM listings
  `);

  const r = stats.rows[0];
  return {
    totalListings: parseInt(r.total),
    withZillowPhotos: parseInt(r.with_zillow),
    withS3Photos: parseInt(r.with_s3),
    pendingDownload: parseInt(r.with_zillow) - parseInt(r.with_s3),
    totalZillowPhotos: parseInt(r.total_zillow_photos) || 0,
    totalS3Photos: parseInt(r.total_s3_photos) || 0,
  };
}
