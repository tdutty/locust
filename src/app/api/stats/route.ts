import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const range = searchParams.get('range') || '7d';

    const daysMap: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 };
    const days = daysMap[range] || 7;

    const db = await getDb();

    // Email stats
    const emailsSent = db.prepare(`
      SELECT COUNT(*) as count FROM email_log
      WHERE sent_at >= datetime('now', '-${days} days')
    `).get() as { count: number };

    const emailsByType = db.prepare(`
      SELECT lead_type, COUNT(*) as count FROM email_log
      WHERE sent_at >= datetime('now', '-${days} days')
      GROUP BY lead_type
    `).all() as { lead_type: string; count: number }[];

    // Previous period for comparison
    const prevEmailsSent = db.prepare(`
      SELECT COUNT(*) as count FROM email_log
      WHERE sent_at >= datetime('now', '-${days * 2} days')
        AND sent_at < datetime('now', '-${days} days')
    `).get() as { count: number };

    // Pipeline stats
    const pipelineByStage = db.prepare(`
      SELECT stage, COUNT(*) as count, COALESCE(SUM(value), 0) as total_value
      FROM pipeline_deals
      GROUP BY stage
    `).all() as { stage: string; count: number; total_value: number }[];

    const totalDeals = db.prepare('SELECT COUNT(*) as count FROM pipeline_deals').get() as { count: number };

    // Daily breakdown for the period
    const dailyEmails = db.prepare(`
      SELECT date(sent_at) as day, COUNT(*) as count
      FROM email_log
      WHERE sent_at >= datetime('now', '-${days} days')
      GROUP BY date(sent_at)
      ORDER BY day
    `).all() as { day: string; count: number }[];

    // Top subjects
    const topSubjects = db.prepare(`
      SELECT subject, COUNT(*) as send_count
      FROM email_log
      WHERE sent_at >= datetime('now', '-${days} days')
      GROUP BY subject
      ORDER BY send_count DESC
      LIMIT 5
    `).all() as { subject: string; send_count: number }[];

    // Recent activity
    const recentActivity = db.prepare(`
      SELECT a.*, d.name as deal_name, d.company as deal_company
      FROM activity_log a
      LEFT JOIN pipeline_deals d ON a.deal_id = d.id
      ORDER BY a.created_at DESC
      LIMIT 10
    `).all();

    return NextResponse.json({
      emailsSent: emailsSent.count,
      emailsSentPrev: prevEmailsSent.count,
      emailsByType,
      pipelineByStage,
      totalDeals: totalDeals.count,
      dailyEmails,
      topSubjects,
      recentActivity,
      range,
    });
  } catch (error: any) {
    console.error('Stats GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
