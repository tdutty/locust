import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const range = searchParams.get('range') || '7d';

    const daysMap: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 };
    const days = daysMap[range] || 7;

    // Email stats
    const emailsSent = await query(
      `SELECT COUNT(*) as count FROM email_log WHERE sent_at >= NOW() - $1::INTERVAL`,
      [`${days} days`]
    );

    const emailsByType = await query(
      `SELECT lead_type, COUNT(*) as count FROM email_log
       WHERE sent_at >= NOW() - $1::INTERVAL
       GROUP BY lead_type`,
      [`${days} days`]
    );

    // Previous period for comparison
    const prevEmailsSent = await query(
      `SELECT COUNT(*) as count FROM email_log
       WHERE sent_at >= NOW() - $1::INTERVAL
         AND sent_at < NOW() - $2::INTERVAL`,
      [`${days * 2} days`, `${days} days`]
    );

    // Pipeline stats
    const pipelineByStage = await query(`
      SELECT stage, COUNT(*) as count, COALESCE(SUM(value), 0) as total_value
      FROM pipeline_deals
      GROUP BY stage
    `);

    const totalDeals = await query('SELECT COUNT(*) as count FROM pipeline_deals');

    // Daily breakdown for the period
    const dailyEmails = await query(
      `SELECT DATE(sent_at) as day, COUNT(*) as count
       FROM email_log
       WHERE sent_at >= NOW() - $1::INTERVAL
       GROUP BY DATE(sent_at)
       ORDER BY day`,
      [`${days} days`]
    );

    // Top subjects
    const topSubjects = await query(
      `SELECT subject, COUNT(*) as send_count
       FROM email_log
       WHERE sent_at >= NOW() - $1::INTERVAL
       GROUP BY subject
       ORDER BY send_count DESC
       LIMIT 5`,
      [`${days} days`]
    );

    // Recent activity
    const recentActivity = await query(`
      SELECT a.*, d.name as deal_name, d.company as deal_company
      FROM activity_log a
      LEFT JOIN pipeline_deals d ON a.deal_id = d.id
      ORDER BY a.created_at DESC
      LIMIT 10
    `);

    return NextResponse.json({
      emailsSent: parseInt(emailsSent.rows[0].count),
      emailsSentPrev: parseInt(prevEmailsSent.rows[0].count),
      emailsByType: emailsByType.rows,
      pipelineByStage: pipelineByStage.rows,
      totalDeals: parseInt(totalDeals.rows[0].count),
      dailyEmails: dailyEmails.rows,
      topSubjects: topSubjects.rows,
      recentActivity: recentActivity.rows,
      range,
    });
  } catch (error: any) {
    console.error('Stats GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
