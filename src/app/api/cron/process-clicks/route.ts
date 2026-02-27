import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { buildOutboundHtml } from '@/lib/email-templates';
import {
  upgradeContactStatus,
  upsertPipelineDeal,
  scheduleFollowUpEmail,
} from '@/lib/pipeline-utils';

function validateCronAuth(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ') && authHeader.slice(7) === cronSecret) {
    return true;
  }

  const { searchParams } = new URL(request.url);
  return searchParams.get('secret') === cronSecret;
}

type ClickType = 'booking' | 'pdf' | 'general';

function classifyClick(url: string): ClickType {
  if (url.includes('cal.com')) return 'booking';
  if (url.includes('/docs/') || url.includes('.pdf')) return 'pdf';
  return 'general';
}

function buildFollowUp(
  firstName: string,
  clickType: ClickType,
  bookingUrl: string,
): { subject: string; body: string } {
  switch (clickType) {
    case 'booking':
      return {
        subject: `Re: Quick follow-up`,
        body: `Hi ${firstName},\n\nI noticed you were looking at available times for a conversation. If none of those worked, I am happy to suggest a few alternatives — or feel free to pick a time that suits you best:\n\n${bookingUrl}\n\nBest regards,\nRobert Gilbert`,
      };
    case 'pdf':
      return {
        subject: `Re: Quick follow-up`,
        body: `Hi ${firstName},\n\nI saw you had a chance to review the overview materials. I would be glad to walk you through the details and answer any questions. Would a brief call work?\n\n${bookingUrl}\n\nBest regards,\nRobert Gilbert`,
      };
    default:
      return {
        subject: `Re: Quick follow-up`,
        body: `Hi ${firstName},\n\nThanks for your interest in SweetLease. I would welcome the opportunity to connect and discuss how we can help. Here is my calendar if a quick call works:\n\n${bookingUrl}\n\nBest regards,\nRobert Gilbert`,
      };
  }
}

export async function GET(request: NextRequest) {
  if (!validateCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const bookingUrl = process.env.CALCOM_BOOKING_URL || 'https://cal.com/terrell-gilbert-bnq7m3/sweetlease-intro';

  try {
    const result = await query(
      `SELECT DISTINCT ON (c.id)
        c.id as contact_id, c.name, c.email, c.contact_type, c.org_name,
        tl.destination_url, lc.clicked_at, lc.user_agent
      FROM link_clicks lc
      JOIN tracked_links tl ON lc.tracked_link_id = tl.id
      JOIN contacts c ON tl.contact_id = c.id
      WHERE c.status = 'contacted'
        AND NOT EXISTS (
          SELECT 1 FROM scheduled_emails se
          WHERE se.contact_id = c.id AND se.subject = 'Re: Quick follow-up'
        )
        AND NOT EXISTS (
          SELECT 1 FROM response_log r
          WHERE r.contact_id = c.id AND r.processed_at > lc.clicked_at
        )
        AND lc.user_agent NOT ILIKE '%bot%'
        AND lc.user_agent NOT ILIKE '%prefetch%'
        AND lc.user_agent NOT ILIKE '%preview%'
      ORDER BY c.id, lc.clicked_at DESC`
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ processed: 0, skipped: 0, errors: 0, message: 'No unprocessed clicks found' });
    }

    let processed = 0;
    let skipped = 0;
    let errors = 0;

    for (const row of result.rows) {
      try {
        const firstName = (row.name || '').split(' ')[0] || 'there';
        const clickType = classifyClick(row.destination_url);
        const { subject, body } = buildFollowUp(firstName, clickType, bookingUrl);
        const htmlBody = buildOutboundHtml(body);

        // Upgrade contact status: contacted → replied
        await upgradeContactStatus(row.contact_id, 'replied');

        // Upsert pipeline deal with needs_followup outcome
        const dealId = await upsertPipelineDeal(
          row.contact_id,
          row.contact_type || 'landlord',
          'needs_followup',
          row.name || 'Unknown',
          row.org_name || null,
        );

        // Log to activity_log
        await query(
          `INSERT INTO activity_log (deal_id, activity_type, description, metadata)
           VALUES ($1, 'link_click_followup', $2, $3)`,
          [
            dealId,
            `Auto follow-up triggered by ${clickType} link click`,
            JSON.stringify({
              click_type: clickType,
              destination_url: row.destination_url,
              clicked_at: row.clicked_at,
              user_agent: row.user_agent,
            }),
          ]
        );

        // Schedule follow-up email with 15-minute delay
        await scheduleFollowUpEmail(
          row.email,
          row.contact_id,
          row.contact_type || 'landlord',
          subject,
          body,
          htmlBody,
          15 * 60 * 1000,
        );

        console.log(`Click follow-up scheduled: ${row.name} (${row.email}) type=${clickType}`);
        processed++;
      } catch (err: any) {
        console.error(`Failed to process click for contact ${row.contact_id}:`, err.message);
        errors++;
      }
    }

    return NextResponse.json({ processed, skipped, errors, total: result.rows.length });
  } catch (error: any) {
    console.error('Process-clicks cron error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process clicks' },
      { status: 500 }
    );
  }
}
