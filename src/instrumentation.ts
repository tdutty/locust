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
        const data = await res.json();
        console.log(`[cron] ${name} →`, JSON.stringify(data));
      } catch (err: any) {
        console.error(`[cron] ${name} failed:`, err.message);
      }
    }

    // ─── Schedules ────────────────────────────────────────────────
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

    // trigger-calls: every 1 minute — trigger Retell outbound calls for booked meetings
    cron.default.schedule('*/1 * * * *', () => {
      triggerCron('trigger-calls', '/api/cron/trigger-calls');
    });

    console.log('[cron] Scheduler started — 4 jobs registered');
    console.log('[cron]   process-inbox     : */2 * * * *  (every 2 min)');
    console.log('[cron]   send-emails       : */1 * * * *  (every 1 min)');
    console.log('[cron]   advance-sequences : 0 * * * *    (every hour)');
    console.log('[cron]   trigger-calls     : */1 * * * *  (every 1 min)');
  }
}
