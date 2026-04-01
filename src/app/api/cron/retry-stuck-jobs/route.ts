import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const STUCK_THRESHOLD_MINUTES = 10;
const MAX_RETRIES = 1;
const SWEETLEASE_API_URL = process.env.SWEETLEASE_API_URL || '';
const SWEETLEASE_WEBHOOK_SECRET = process.env.SWEETLEASE_WEBHOOK_SECRET || '';

/**
 * Cron: finds tenant match jobs stuck in 'searching' for 10+ minutes.
 * Retries once. If retry fails, marks as failed and alerts admin.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Find stuck jobs
    const stuck = await query(
      `SELECT * FROM tenant_match_jobs
       WHERE status = 'searching'
       AND created_at < NOW() - INTERVAL '${STUCK_THRESHOLD_MINUTES} minutes'
       ORDER BY created_at ASC`,
    );

    if (stuck.rows.length === 0) {
      return NextResponse.json({ success: true, message: 'No stuck jobs', found: 0 });
    }

    console.log(`[retry-stuck] Found ${stuck.rows.length} stuck jobs`);

    let retried = 0;
    let failed = 0;

    for (const job of stuck.rows) {
      const retryCount = job.retry_count || 0;

      if (retryCount >= MAX_RETRIES) {
        // Already retried — mark as failed and alert
        await query(
          `UPDATE tenant_match_jobs SET status = 'failed', updated_at = NOW() WHERE id = $1`,
          [job.id]
        );

        // Update SweetLease match request status
        if (SWEETLEASE_API_URL && SWEETLEASE_WEBHOOK_SECRET) {
          try {
            await fetch(`${SWEETLEASE_API_URL}/api/tenant-match/status-update`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Webhook-Secret': SWEETLEASE_WEBHOOK_SECRET,
              },
              body: JSON.stringify({
                matchRequestId: job.sweetlease_match_request_id,
                status: 'searching', // Keep as searching so admin can retry from Hive
                matchCount: 0,
              }),
            });
          } catch {}
        }

        // Send alert email
        try {
          const { Resend } = await import('resend');
          const resend = new Resend(process.env.RESEND_API_KEY);
          await resend.emails.send({
            from: 'SweetLease Alerts <no-reply@sweetlease.io>',
            to: ['tgilbert@sweetlease.io', 'terrellgilb5@gmail.com'],
            subject: `Listing import failed: ${job.city}, ${job.state}`,
            text: `The listing import for ${job.tenant_name} (${job.tenant_email}) in ${job.city}, ${job.state} failed after ${MAX_RETRIES} retries.\n\nJob ID: ${job.id}\nBudget: $${job.budget_max}\nBedrooms: ${job.bedrooms}\n\nPlease retry manually from Hive or check Locust logs.`,
          });
        } catch {}

        failed++;
        console.log(`[retry-stuck] Job ${job.id} (${job.city}) failed after max retries`);
        continue;
      }

      // Retry the search
      try {
        await query(
          `UPDATE tenant_match_jobs SET status = 'searching', retry_count = COALESCE(retry_count, 0) + 1, updated_at = NOW() WHERE id = $1`,
          [job.id]
        );

        // Re-trigger the search by calling ourselves
        const searchUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://locust-m7ng3.ondigitalocean.app'}/api/tenant-match/search`;
        fetch(searchUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Secret': process.env.SWEETLEASE_WEBHOOK_SECRET || '',
          },
          body: JSON.stringify({
            matchRequestId: job.sweetlease_match_request_id,
            email: job.tenant_email,
            name: job.tenant_name,
            city: job.city,
            state: job.state,
            budgetMin: job.budget_min,
            budgetMax: job.budget_max,
            bedrooms: job.bedrooms,
            moveInDate: job.move_in_date,
            amenities: [],
          }),
        }).catch(() => {}); // Fire and forget

        retried++;
        console.log(`[retry-stuck] Retrying job ${job.id} (${job.city})`);
      } catch (err) {
        console.error(`[retry-stuck] Failed to retry job ${job.id}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      found: stuck.rows.length,
      retried,
      failed,
    });
  } catch (error: any) {
    console.error('[retry-stuck] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
