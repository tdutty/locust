import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

interface GenerateEmailRequest {
  leadType: 'landlord' | 'employer' | 'university';
  lead: {
    name: string;
    email: string;
    company?: string;
    city?: string;
    properties?: number;
    units?: number;
    relocationsPerYear?: number;
    industry?: string;
    university?: string;
    enrollment?: number;
    offCampusPercent?: number;
    avgRent?: number;
    contactRole?: string;
    contactDepartment?: string;
    partnershipType?: string;
  };
  emailNumber: number;
}

const SYSTEM_PROMPT = `You are Locust, the AI Account Executive for SweetLease. Your job is to write cold outreach emails to landlords, employers, and university housing partners about SweetLease's corporate housing platform.

SweetLease connects independent landlords with relocating corporate employees. Key value props:
- For landlords: Fill vacancies 3x faster (7-14 days vs 30-45 days), pre-screened tenants with employer-backed lease guarantees, zero marketing spend
- For employers: Employees pay $99.99 one-time fee, get $100-300/month rent savings, pre-verified landlords, move-in coordination, zero cost to employer
- For universities: Help students find quality off-campus housing, reduce housing insecurity, free housing resource for student services, partnership opportunities (workshops, ambassador programs, co-branded housing fairs)

Email sequence strategy for landlords/employers (5 emails):
1. Hook - Grab attention with a specific insight about their business
2. Social Proof - Reference similar companies/landlords using the service
3. ROI - Hard numbers on cost savings and time savings
4. Urgency - Limited onboarding spots, seasonal demand
5. Breakup - Last email, ask if they want to be removed

Email sequence strategy for universities (5 emails):
1. Housing Office Introduction - Introduce SweetLease as a free housing resource for students
2. Follow-Up with Data - Share housing data specific to their market (avg rent, off-campus stats)
3. International Student Office - Target international student housing needs
4. Graduate Student Association - Partnership for grad/professional student housing
5. Housing Fair Booth Request - Ask for presence at upcoming housing fairs/orientation

Rules:
- Keep emails under 200 words
- Use the lead's first name
- Reference specific details (city, property count, company, relocations, enrollment, off-campus %)
- End with a CTA to Calendly: https://calendly.com/sweetlease/intro (landlords), https://calendly.com/sweetlease/employer-intro (employers), or https://calendly.com/sweetlease/university-partnership (universities)
- Sign off as Terrell Gilbert, SweetLease
- Be conversational, not salesy
- Never use exclamation marks excessively
- Vary subject lines - make them specific and personal`;

const LANDLORD_SEQUENCES = [
  {
    subject: 'How to compete with corporate landlords',
    body: (lead: GenerateEmailRequest['lead']) => `Hi ${lead.name.split(' ')[0]},

I noticed you manage ${lead.properties || 'several'} properties in ${lead.city || 'Texas'}. Impressive portfolio.

The big corporate landlords are eating independent landlords alive right now. They have dedicated sales teams reaching out to relocating employees before those tenants ever hit Zillow or Apartments.com.

But here's the thing: you can access that same pipeline without building an entire corporate infrastructure.

SweetLease partners with HR departments at companies like Tesla, Apple, and Bank of America. When their employees need housing, we match them with landlords like you first.

These are W-2 employed tenants, pre-vetted by Fortune 500 companies, ready to sign quickly at competitive rates.

Want to see how it works? I can show you in 15 minutes: https://calendly.com/sweetlease/intro

Best,
Terrell Gilbert
SweetLease | Batch Fulfillment for Landlords`,
  },
  {
    subject: '{{company}} relocations - a better way',
    body: (lead: GenerateEmailRequest['lead']) => `Hi ${lead.name.split(' ')[0]},

Following up on my last note.

Corporate landlords fill vacancies 3x faster than independent landlords. Not because they have better properties, but because they have better distribution.

They're embedded in relocation networks. When a Tesla engineer moves to ${lead.city || 'Austin'}, corporate landlords hear about it weeks before that tenant starts browsing listings.

SweetLease gives you that same advantage.

Last month, we placed 47 relocating employees in ${lead.city || 'Texas'} properties. Average days to lease: 11.

Would it make sense to chat for 15 minutes? I can walk you through exactly how we'd work with your ${lead.units || 'units'} units.

https://calendly.com/sweetlease/intro

Best,
Terrell Gilbert
SweetLease`,
  },
  {
    subject: 'Your ${city} vacancies are costing you $X/day',
    body: (lead: GenerateEmailRequest['lead']) => `Hi ${lead.name.split(' ')[0]},

Quick math:

If your average unit rents for $1,800/month, that's $60/day.

A 30-day vacancy costs you $1,800. A 60-day vacancy costs $3,600.

Corporate landlords minimize this by having dedicated tenant pipelines. They don't wait for tenants to find them.

You could hire a sales team to build corporate relationships. Or you could plug into the network we've already built.

Our landlord partners in ${lead.city || 'your area'} are averaging 14-day fills with relocating employees from major companies.

Worth a 15-minute call to explore? https://calendly.com/sweetlease/intro

Best,
Terrell Gilbert
SweetLease`,
  },
  {
    subject: 'Should I close your file?',
    body: (lead: GenerateEmailRequest['lead']) => `Hi ${lead.name.split(' ')[0]},

I've reached out a few times about connecting your properties with relocating employees.

I know you're busy managing ${lead.properties || 'your'} properties, so I wanted to check if this is something worth exploring or if I should close your file for now.

Either way, no hard feelings. Just let me know.

If the timing is better later this year, I'm happy to reconnect then.

Best,
Terrell Gilbert
SweetLease`,
  },
  {
    subject: 'We\'re onboarding 5 ${city} landlords this month',
    body: (lead: GenerateEmailRequest['lead']) => `Hi ${lead.name.split(' ')[0]},

Last chance note:

We're onboarding 5 more landlords in ${lead.city || 'your area'} this month to handle increased relocation demand from tech companies.

If you'd like to be considered, here's what we need:
1. 15-minute intro call
2. List of available or soon-to-be-available units
3. Your pricing guidelines

That's it. No long-term contracts, no listing fees.

Interested? https://calendly.com/sweetlease/intro

Best,
Terrell Gilbert
SweetLease`,
  },
];

const EMPLOYER_SEQUENCES = [
  {
    subject: 'Housing support for relocating employees',
    body: (lead: GenerateEmailRequest['lead']) => `Hi ${lead.name?.split(' ')[0] || 'there'},

I understand ${lead.company || 'your company'} relocates ${lead.relocationsPerYear || 'hundreds of'} employees each year. Finding quality housing quickly is often one of the biggest pain points in the relocation process.

SweetLease works with landlords who prioritize corporate relocations. That means your employees get access to pre-vetted, move-in ready properties before they hit the public market.

Benefits for your employees:
- Access to quality rentals 2-3 weeks before public listing
- Pre-negotiated rates with flexible lease terms
- Dedicated support throughout the leasing process

We're already partnered with HR teams at Tesla, Apple, and Bank of America.

Would it be helpful to explore how this could benefit your relocating employees? I can share a brief overview in 15 minutes.

Best,
Terrell Gilbert
SweetLease | Corporate Housing Solutions`,
  },
  {
    subject: 'Reducing relocation friction for ${company} employees',
    body: (lead: GenerateEmailRequest['lead']) => `Hi ${lead.name?.split(' ')[0] || 'there'},

Following up on my previous note about housing support for relocating employees.

The #1 complaint we hear from HR teams: employees struggle to find quality housing fast enough, which delays start dates and hurts productivity.

SweetLease solves this by giving your employees first access to a network of landlords who specialize in corporate relocations.

The result? Your employees find housing 40% faster than through traditional channels.

Would a quick call make sense to explore if this could help ${lead.company || 'your'} team?

https://calendly.com/sweetlease/employer-intro

Best,
Terrell Gilbert
SweetLease`,
  },
  {
    subject: 'Case study: How Tesla reduced relocation housing time by 50%',
    body: (lead: GenerateEmailRequest['lead']) => `Hi ${lead.name?.split(' ')[0] || 'there'},

Quick case study:

A major tech company was struggling with relocation delays. New hires were spending 6+ weeks finding housing, delaying start dates and burning through temporary housing budgets.

After partnering with SweetLease:
- Average time to find housing: 14 days (down from 45)
- Employee satisfaction with relocation: up 35%
- Temporary housing costs: down 40%

I'd love to share more details and explore if similar results are possible for ${lead.company || 'your organization'}.

15 minutes work for you? https://calendly.com/sweetlease/employer-intro

Best,
Terrell Gilbert
SweetLease`,
  },
  {
    subject: 'Quick question about ${company} relocations',
    body: (lead: GenerateEmailRequest['lead']) => `Hi ${lead.name?.split(' ')[0] || 'there'},

I've reached out a couple times about housing support for relocating employees.

I'm guessing either:
A) This isn't a priority right now
B) You're already happy with your current solution
C) My emails got buried

If A or B, totally understand. Just let me know and I'll close your file.

If C, here's the 30-second version: SweetLease gives your relocating employees first access to quality rentals before they hit the public market. Faster housing = faster start dates = happier employees.

Worth a quick chat?

Best,
Terrell Gilbert
SweetLease`,
  },
  {
    subject: 'Closing the loop on housing support',
    body: (lead: GenerateEmailRequest['lead']) => `Hi ${lead.name?.split(' ')[0] || 'there'},

This will be my last note about SweetLease's corporate housing solution.

If supporting ${lead.company || 'your'} relocating employees with faster, easier housing isn't a current priority, I completely understand.

If things change or you'd like to explore this down the road, I'm always happy to reconnect: https://calendly.com/sweetlease/employer-intro

Wishing you and the team continued success!

Best,
Terrell Gilbert
SweetLease`,
  },
];

const UNIVERSITY_SEQUENCES = [
  {
    subject: 'Free housing resource for {{university}} students',
    body: (lead: GenerateEmailRequest['lead']) => `Hi ${lead.name?.split(' ')[0] || 'there'},

I'm reaching out because I know ${lead.university || 'your university'} has ${lead.enrollment ? lead.enrollment.toLocaleString() : 'thousands of'} students, and finding quality off-campus housing is one of the biggest challenges they face.

SweetLease is a free platform that helps students find pre-vetted, competitively priced off-campus housing. We work directly with local landlords to ensure quality and fair pricing.

For ${lead.university || 'your university'} students specifically:
- ${lead.offCampusPercent || '40'}% of students live off-campus and need housing support
- Average rent in ${lead.city || 'your area'} is $${lead.avgRent || '1,200'}/month - we help students find options $100-300 below market
- Pre-vetted landlords with quality guarantees

There's zero cost to the university. We simply want to be a resource your ${lead.contactDepartment || 'housing office'} can recommend to students.

Would you be open to a 15-minute call to explore how this could benefit your students?

https://calendly.com/sweetlease/university-partnership

Best,
Terrell Gilbert
SweetLease | Student Housing Solutions`,
  },
  {
    subject: 'Housing data for ${city} - {{university}} students',
    body: (lead: GenerateEmailRequest['lead']) => `Hi ${lead.name?.split(' ')[0] || 'there'},

Following up on my previous note about SweetLease as a housing resource for ${lead.university || 'your'} students.

I wanted to share some data we've gathered about the ${lead.city || 'local'} rental market that might be useful:

The average off-campus rent in ${lead.city || 'your area'} has increased 12% year-over-year. For students at ${lead.university || 'your university'}, that means finding affordable housing is harder than ever.

SweetLease currently has ${Math.floor(Math.random() * 50 + 30)} verified listings within 5 miles of campus, with average rents 15-20% below market rate.

We'd love to share a full market report for ${lead.city || 'your area'} with your team - no strings attached.

Worth a quick chat? https://calendly.com/sweetlease/university-partnership

Best,
Terrell Gilbert
SweetLease`,
  },
  {
    subject: 'Housing support for {{university}} international students',
    body: (lead: GenerateEmailRequest['lead']) => `Hi ${lead.name?.split(' ')[0] || 'there'},

International students face unique housing challenges: no U.S. credit history, unfamiliarity with local rental markets, and tight timelines between arrival and semester start.

SweetLease addresses all three:
- No credit history required - we use alternative verification
- Curated listings near ${lead.university || 'campus'} with clear terms
- Move-in coordination so students arrive to ready housing

We're already supporting international students at several universities and would love to extend this to ${lead.university || 'your institution'}.

This could be a great resource for your international student orientation packets and pre-arrival communications.

Could we schedule 15 minutes to discuss? https://calendly.com/sweetlease/university-partnership

Best,
Terrell Gilbert
SweetLease`,
  },
  {
    subject: 'Graduate student housing partnership - {{university}}',
    body: (lead: GenerateEmailRequest['lead']) => `Hi ${lead.name?.split(' ')[0] || 'there'},

Graduate and professional students often have different housing needs than undergrads: they want quiet neighborhoods, longer lease terms, and proximity to specific facilities.

SweetLease curates housing options specifically for grad students, with filters for these exact preferences.

We'd love to explore a partnership with ${lead.university || 'your'} graduate student association:
- Co-branded housing guide for incoming grad students
- Featured in orientation materials
- Dedicated landing page for ${lead.university || 'your'} grad students

This is completely free and designed to make your students' transition easier.

Interested in learning more? https://calendly.com/sweetlease/university-partnership

Best,
Terrell Gilbert
SweetLease`,
  },
  {
    subject: 'Housing fair booth request - {{university}}',
    body: (lead: GenerateEmailRequest['lead']) => `Hi ${lead.name?.split(' ')[0] || 'there'},

I know ${lead.university || 'your university'} hosts housing fairs and orientation events for incoming students. We'd love to participate.

SweetLease would provide:
- Free housing search assistance for students at the event
- Local rental market guides and pricing data for ${lead.city || 'your area'}
- A dedicated ${lead.university || 'university'} landing page for students who want to explore listings

We're flexible on format - whether that's a booth at a housing fair, a 20-minute presentation during orientation, or simply being listed as a recommended resource.

Would it be possible to discuss getting involved in your next student housing event?

https://calendly.com/sweetlease/university-partnership

Best,
Terrell Gilbert
SweetLease`,
  },
];

async function generateWithAI(lead: GenerateEmailRequest['lead'], leadType: string, emailNumber: number): Promise<{ subject: string; body: string } | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const client = new Anthropic({ apiKey });
    const sequenceNames = leadType === 'university'
      ? ['Housing Office Intro', 'Follow-Up with Data', 'International Student Office', 'Graduate Association', 'Housing Fair Booth']
      : ['Hook', 'Social Proof', 'ROI', 'Urgency', 'Breakup'];

    const leadContext = leadType === 'landlord'
      ? `Landlord: ${lead.name}, manages ${lead.properties || 'multiple'} properties in ${lead.city || 'the area'}, ${lead.units || 'many'} total units`
      : leadType === 'university'
      ? `University Contact: ${lead.name}, ${lead.contactRole || 'Housing Director'} at ${lead.university || 'the university'} in ${lead.city || 'the area'}. Enrollment: ${lead.enrollment || 'unknown'}. Off-campus: ${lead.offCampusPercent || 'unknown'}%. Avg rent: $${lead.avgRent || 'unknown'}. Department: ${lead.contactDepartment || 'Housing'}. Partnership type: ${lead.partnershipType || 'housing_resource'}`
      : `Employer: ${lead.name} at ${lead.company || 'their company'}, relocates ${lead.relocationsPerYear || 'many'} employees/year to ${lead.city || 'various locations'}, ${lead.industry || 'various'} industry`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Write email #${emailNumber} (${sequenceNames[emailNumber - 1]}) for this ${leadType}:\n\n${leadContext}\n\nRespond in JSON format: {"subject": "...", "body": "..."}`
      }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return null;
  } catch (err) {
    console.error('Claude AI generation failed, using template:', err);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateEmailRequest = await request.json();
    const { leadType, lead, emailNumber } = body;

    if (!leadType || !lead || !emailNumber) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Try AI generation first
    const aiResult = await generateWithAI(lead, leadType, emailNumber);
    if (aiResult) {
      return NextResponse.json({
        to: lead.email,
        subject: aiResult.subject,
        body: aiResult.body,
        emailNumber,
        leadType,
        source: 'ai',
        lead: { name: lead.name, email: lead.email },
      });
    }

    // Fallback to templates
    const sequences = leadType === 'landlord' ? LANDLORD_SEQUENCES : leadType === 'university' ? UNIVERSITY_SEQUENCES : EMPLOYER_SEQUENCES;
    const index = Math.min(emailNumber - 1, sequences.length - 1);
    const template = sequences[index];

    let subject = template.subject
      .replace('{{company}}', lead.company || lead.name)
      .replace('{{university}}', lead.university || lead.name)
      .replace('${city}', lead.city || 'your area')
      .replace('${company}', lead.company || 'your company');

    const emailBody = template.body(lead);

    return NextResponse.json({
      to: lead.email,
      subject,
      body: emailBody,
      emailNumber,
      leadType,
      source: 'template',
      lead: { name: lead.name, email: lead.email },
    });
  } catch (error) {
    console.error('Error generating email:', error);
    return NextResponse.json({ error: 'Failed to generate email' }, { status: 500 });
  }
}
