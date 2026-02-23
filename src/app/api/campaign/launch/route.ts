import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max for batch sends

const CRICKET_API_URL = process.env.CRICKET_API_URL || 'http://198.199.78.62:8081';

interface Employer {
  id: string;
  company: string;
  contact_name: string;
  contact_title: string;
  contact_email: string;
  phone: string;
  relocation_count: number;
  city: string;
  state: string;
  industry: string;
  employees: number;
  score: number;
  status: string;
}

// 5-email employer sequences
const EMPLOYER_SEQUENCES = [
  {
    subject: (lead: Employer) => `Housing support for ${lead.company} relocating employees`,
    body: (lead: Employer) => `Hi ${lead.contact_name?.split(' ')[0] || 'there'},

I understand ${lead.company} relocates ${lead.relocation_count || 'hundreds of'} employees each year. Finding quality housing quickly is often one of the biggest pain points in the relocation process.

SweetLease works with landlords who prioritize corporate relocations. That means your employees get access to pre-vetted, move-in ready properties before they hit the public market.

Benefits for your employees:
- Access to quality rentals 2-3 weeks before public listing
- Pre-negotiated rates with flexible lease terms
- Dedicated support throughout the leasing process

We're already partnered with HR teams at major employers across ${lead.city || 'the country'}.

Would it be helpful to explore how this could benefit your relocating employees? I can share a brief overview in 15 minutes.

Best,
Robert Gilbert
SweetLease | Corporate Housing Solutions`,
  },
  {
    subject: (lead: Employer) => `Reducing relocation friction for ${lead.company} employees`,
    body: (lead: Employer) => `Hi ${lead.contact_name?.split(' ')[0] || 'there'},

Following up on my previous note about housing support for relocating employees.

The #1 complaint we hear from HR teams: employees struggle to find quality housing fast enough, which delays start dates and hurts productivity.

SweetLease solves this by giving your employees first access to a network of landlords who specialize in corporate relocations.

The result? Your employees find housing 40% faster than through traditional channels.

Would a quick call make sense to explore if this could help ${lead.company}'s team?

https://calendly.com/sweetlease/employer-intro

Best,
Robert Gilbert
SweetLease`,
  },
  {
    subject: (_lead: Employer) => `Case study: How companies reduced relocation housing time by 50%`,
    body: (lead: Employer) => `Hi ${lead.contact_name?.split(' ')[0] || 'there'},

Quick case study:

A major employer was struggling with relocation delays. New hires were spending 6+ weeks finding housing, delaying start dates and burning through temporary housing budgets.

After partnering with SweetLease:
- Average time to find housing: 14 days (down from 45)
- Employee satisfaction with relocation: up 35%
- Temporary housing costs: down 40%

I'd love to share more details and explore if similar results are possible for ${lead.company}.

15 minutes work for you? https://calendly.com/sweetlease/employer-intro

Best,
Robert Gilbert
SweetLease`,
  },
  {
    subject: (lead: Employer) => `Quick question about ${lead.company} relocations`,
    body: (lead: Employer) => `Hi ${lead.contact_name?.split(' ')[0] || 'there'},

I've reached out a couple times about housing support for relocating employees.

I'm guessing either:
A) This isn't a priority right now
B) You're already happy with your current solution
C) My emails got buried

If A or B, totally understand. Just let me know and I'll close your file.

If C, here's the 30-second version: SweetLease gives your relocating employees first access to quality rentals before they hit the public market. Faster housing = faster start dates = happier employees.

Worth a quick chat?

Best,
Robert Gilbert
SweetLease`,
  },
  {
    subject: (_lead: Employer) => `Closing the loop on housing support`,
    body: (lead: Employer) => `Hi ${lead.contact_name?.split(' ')[0] || 'there'},

This will be my last note about SweetLease's corporate housing solution.

If supporting ${lead.company} relocating employees with faster, easier housing isn't a current priority, I completely understand.

If things change or you'd like to explore this down the road, I'm always happy to reconnect: https://calendly.com/sweetlease/employer-intro

Wishing you and the team continued success!

Best,
Robert Gilbert
SweetLease`,
  },
];

function getTransporter() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!user || !pass) {
    throw new Error('SMTP_USER and SMTP_PASSWORD environment variables are required');
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.porkbun.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: { user, pass },
  });
}

async function fetchEmployersByCities(cities: string[]): Promise<Employer[]> {
  const allEmployers: Employer[] = [];

  for (const city of cities) {
    try {
      const params = new URLSearchParams({ city, limit: '100' });
      const response = await fetch(`${CRICKET_API_URL}/api/employers?${params.toString()}`, {
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      });

      if (response.ok) {
        const data = await response.json();
        const employers = (Array.isArray(data) ? data : data.employers || []).map((e: any) => ({
          id: String(e.id),
          company: e.name || e.company || '',
          contact_name: e.contact_name || 'HR Department',
          contact_title: e.contact_title || '',
          contact_email: e.contact_email || '',
          phone: e.phone || '',
          relocation_count: e.avg_relocations_per_year ?? e.relocation_count ?? 0,
          city: e.city || city,
          state: e.state || '',
          industry: (e.industry || '').charAt(0).toUpperCase() + (e.industry || '').slice(1).toLowerCase(),
          employees: e.employee_count ?? e.employees ?? 0,
          score: e.lead_score ?? e.score ?? 0,
          status: (e.status || 'new').toLowerCase(),
        }));
        allEmployers.push(...employers);
      }
    } catch (error) {
      console.error(`Failed to fetch employers for ${city}:`, error);
    }
  }

  return allEmployers;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      cities = ['Chicago', 'Boston', 'Austin'],
      emailNumber = 1,
      dryRun = false,
      targetIndustries,
      targetRoles,
    } = body;

    // Validate email number
    const seqIndex = Math.min(Math.max(emailNumber - 1, 0), EMPLOYER_SEQUENCES.length - 1);
    const template = EMPLOYER_SEQUENCES[seqIndex];

    // Pull employers from Cricket
    const employers = await fetchEmployersByCities(cities);

    if (employers.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No employers found in Cricket for the specified cities',
        cities,
        suggestion: 'Load employer prospect data into Cricket CRM first',
      }, { status: 404 });
    }

    // Filter by industry if specified
    let filtered = employers;
    if (targetIndustries && targetIndustries.length > 0) {
      const industries = targetIndustries.map((i: string) => i.toLowerCase());
      filtered = filtered.filter(e =>
        industries.some((ind: string) => e.industry.toLowerCase().includes(ind))
      );
    }

    // Filter out employers without email
    filtered = filtered.filter(e => e.contact_email && e.contact_email.includes('@'));

    const results: Array<{
      company: string;
      contact: string;
      email: string;
      city: string;
      status: 'sent' | 'skipped' | 'failed';
      messageId?: string;
      error?: string;
    }> = [];

    if (dryRun) {
      // Dry run - just show what would be sent
      for (const employer of filtered) {
        results.push({
          company: employer.company,
          contact: employer.contact_name,
          email: employer.contact_email,
          city: employer.city,
          status: 'skipped',
        });
      }

      return NextResponse.json({
        success: true,
        dryRun: true,
        totalProspects: filtered.length,
        byCities: cities.map((city: string) => ({
          city,
          count: filtered.filter(e => e.city.toLowerCase().includes(city.toLowerCase())).length,
        })),
        emailNumber,
        sequenceSubject: template.subject(filtered[0] || {} as Employer),
        prospects: results,
      });
    }

    // Live send
    const transporter = getTransporter();
    await transporter.verify();

    let sent = 0;
    let failed = 0;

    for (const employer of filtered) {
      try {
        const subject = template.subject(employer);
        const emailBody = template.body(employer);

        const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
    p { margin: 10px 0; }
    a { color: #16a34a; }
  </style>
</head>
<body>
  ${emailBody.split('\n').map((line: string) =>
          line.includes('https://')
            ? `<p><a href="${line.trim()}">${line.trim()}</a></p>`
            : line.trim() ? `<p>${line}</p>` : '<br>'
        ).join('')}
</body>
</html>`;

        const info = await transporter.sendMail({
          from: `"Robert Gilbert" <${process.env.SMTP_USER}>`,
          to: employer.contact_email,
          subject,
          text: emailBody,
          html: htmlBody,
        });

        results.push({
          company: employer.company,
          contact: employer.contact_name,
          email: employer.contact_email,
          city: employer.city,
          status: 'sent',
          messageId: info.messageId,
        });
        sent++;

        // Throttle: 2-second delay between emails to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error: any) {
        results.push({
          company: employer.company,
          contact: employer.contact_name,
          email: employer.contact_email,
          city: employer.city,
          status: 'failed',
          error: error.message,
        });
        failed++;
      }
    }

    return NextResponse.json({
      success: true,
      dryRun: false,
      totalProspects: filtered.length,
      sent,
      failed,
      emailNumber,
      byCities: cities.map((city: string) => ({
        city,
        sent: results.filter(r => r.city.toLowerCase().includes(city.toLowerCase()) && r.status === 'sent').length,
        failed: results.filter(r => r.city.toLowerCase().includes(city.toLowerCase()) && r.status === 'failed').length,
      })),
      results,
    });
  } catch (error: any) {
    console.error('Campaign launch error:', error);
    return NextResponse.json(
      { error: error.message || 'Campaign launch failed' },
      { status: 500 }
    );
  }
}

// GET endpoint to check campaign status and preview
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const cities = (searchParams.get('cities') || 'Chicago,Boston,Austin').split(',');

  try {
    const employers = await fetchEmployersByCities(cities);
    const withEmail = employers.filter(e => e.contact_email && e.contact_email.includes('@'));

    return NextResponse.json({
      status: 'Campaign API ready',
      availableProspects: withEmail.length,
      byCities: cities.map(city => ({
        city,
        total: employers.filter(e => e.city.toLowerCase().includes(city.toLowerCase())).length,
        withEmail: withEmail.filter(e => e.city.toLowerCase().includes(city.toLowerCase())).length,
      })),
      sequenceEmails: EMPLOYER_SEQUENCES.length,
      usage: {
        dryRun: 'POST with { cities, emailNumber, dryRun: true }',
        liveSend: 'POST with { cities, emailNumber, dryRun: false }',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
