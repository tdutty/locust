/**
 * Next.js Instrumentation — runs once when the server starts.
 * Sets up node-cron schedules that hit the internal cron API routes.
 */

export async function register() {
  // Only run cron in the Node.js runtime (not edge), and only in production
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const cron = await import('node-cron');

    const CRON_SECRET = process.env.CRON_SECRET;
    if (!CRON_SECRET) {
      console.warn('[cron] CRON_SECRET not set — skipping cron scheduler');
      return;
    }

    const PORT = process.env.PORT || '3002';
    const BASE = `http://localhost:${PORT}`;

    async function triggerCron(name: string, path: string) {
      try {
        const url = `${BASE}${path}?secret=${encodeURIComponent(CRON_SECRET!)}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          console.log(`[cron] ${name} →`, JSON.stringify(data));
        } catch {
          console.error(`[cron] ${name} returned non-JSON (${res.status}):`, text.substring(0, 200));
        }
      } catch (err: any) {
        console.error(`[cron] ${name} failed:`, err.message);
      }
    }

    // ─── Schedules ────────────────────────────────────────────────
    let jobCount = 3;

    // process-inbox: every 2 minutes — check IMAP for new replies
    cron.default.schedule('*/2 * * * *', () => {
      triggerCron('process-inbox', '/api/cron/process-inbox');
    });

    // send-emails: every 1 minute — deliver scheduled outbound emails
    cron.default.schedule('*/1 * * * *', () => {
      triggerCron('send-emails', '/api/cron/send-emails');
    });

    // advance-sequences: every hour — advance drip sequences + stale contract follow-ups
    cron.default.schedule('0 * * * *', () => {
      triggerCron('advance-sequences', '/api/cron/advance-sequences');
    });

    // photo-download: every 5 minutes — download listing photos from Zillow to S3
    if (process.env.DO_SPACES_KEY) {
      cron.default.schedule('*/5 * * * *', async () => {
        try {
          const { downloadPhotoBatch, getDownloadProgress } = await import('@/lib/photo-downloader');
          const result = await downloadPhotoBatch(10); // 10 listings per batch (~100 photos)
          if (result.downloaded > 0) {
            const progress = await getDownloadProgress();
            console.log(`[cron] photo-download → ${result.downloaded} downloaded, ${result.failed} failed | ${progress.withS3Photos}/${progress.withZillowPhotos} listings done (${progress.totalS3Photos} total photos)`);
          }
        } catch (err: any) {
          console.error(`[cron] photo-download failed:`, err.message);
        }
      });
      jobCount++;
      console.log('[cron]   photo-download    : */5 * * * *  (every 5 min, 10 listings/batch)');
    }

    // trigger-calls: only schedule if Retell is configured
    if (process.env.RETELL_API_KEY && process.env.RETELL_AGENT_ID) {
      cron.default.schedule('*/1 * * * *', () => {
        triggerCron('trigger-calls', '/api/cron/trigger-calls');
      });
      jobCount = 4;
    } else {
      console.log('[cron] trigger-calls skipped — RETELL_API_KEY/RETELL_AGENT_ID not set');
    }

    console.log(`[cron] Scheduler started — ${jobCount} jobs registered`);
    console.log('[cron]   process-inbox     : */2 * * * *  (every 2 min)');
    console.log('[cron]   send-emails       : */1 * * * *  (every 1 min)');
    console.log('[cron]   advance-sequences : 0 * * * *    (every hour)');
    if (jobCount === 4) {
      console.log('[cron]   trigger-calls     : */1 * * * *  (every 1 min)');
    }
  }
}
