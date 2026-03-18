import { NextRequest, NextResponse } from 'next/server';
import { downloadPhotoBatch, getDownloadProgress } from '@/lib/photo-downloader';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const webhookSecret = process.env.SWEETLEASE_WEBHOOK_SECRET;
    const providedSecret = req.headers.get('x-webhook-secret');
    if (!webhookSecret || providedSecret !== webhookSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const batchSize = body.batchSize || 20;
    const batches = body.batches || 1;

    let totalDownloaded = 0;
    let totalFailed = 0;
    let totalProcessed = 0;

    for (let i = 0; i < batches; i++) {
      const result = await downloadPhotoBatch(batchSize);
      totalDownloaded += result.downloaded;
      totalFailed += result.failed;
      totalProcessed += result.processed;

      if (result.processed === 0) break; // No more to process
    }

    const progress = await getDownloadProgress();

    return NextResponse.json({
      ...progress,
      batchResult: { totalProcessed, totalDownloaded, totalFailed },
    });
  } catch (error: any) {
    console.error('[photos] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const progress = await getDownloadProgress();
    return NextResponse.json(progress);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
