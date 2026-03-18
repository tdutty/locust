import { NextResponse } from 'next/server';
import { getEnrichmentProgress } from '@/lib/listing-enricher';

export async function GET() {
  try {
    const progress = await getEnrichmentProgress();

    // Estimate credits remaining from Scrapeak
    // Each listing costs ~20 credits (zpid lookup + property detail)
    const estimatedCreditsNeeded = progress.pending * 20;
    const creditsBurnRate = progress.enrichedLastHour * 20;

    // Health assessment
    const issues: string[] = [];
    let status: 'healthy' | 'degraded' | 'blocked' | 'idle' | 'credits_low' = 'healthy';

    if (progress.enrichedLastHour === 0 && progress.pending > 0) {
      status = 'idle';
      issues.push('No listings enriched in the last hour — cron may not be running');
    }

    if (progress.failedLastHour > progress.enrichedLastHour && progress.failedLastHour > 5) {
      status = 'degraded';
      issues.push(`${progress.failedLastHour} failures vs ${progress.enrichedLastHour} successes in the last hour`);
    }

    // Credit warning — estimate based on burn rate
    if (estimatedCreditsNeeded > 400000) {
      issues.push(`Estimated ${estimatedCreditsNeeded.toLocaleString()} credits needed for remaining ${progress.pending.toLocaleString()} listings`);
    }

    const successRate = (progress.enrichedLastHour + progress.failedLastHour) > 0
      ? Math.round((progress.enrichedLastHour / (progress.enrichedLastHour + progress.failedLastHour)) * 100)
      : 100;

    if (successRate < 50 && progress.failedLastHour > 0) {
      status = 'blocked';
      issues.push(`Success rate at ${successRate}% — Scrapeak may be rate limiting`);
    }

    // ETA
    const etaHours = progress.enrichedLastHour > 0
      ? Math.round(progress.pending / progress.enrichedLastHour)
      : null;

    return NextResponse.json({
      ...progress,
      estimatedCreditsNeeded,
      creditsBurnRate,
      successRate,
      etaHours,
      status,
      issues,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
