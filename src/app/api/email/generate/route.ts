import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

interface GenerateEmailRequest {
  leadType: 'landlord' | 'employer' | 'university' | 'residency' | 'benefits-platform' | 'graduate-housing';
  lead: {
    name: string;
    email: string;
    company?: string;
    city?: string;
    state?: string;
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
    title?: string;
    orgName?: string;
    orgEmployeeCount?: number;
  };
  emailNumber: number;
}

const SYSTEM_PROMPT = `You are Locust, the AI Account Executive for SweetLease. Your job is to write cold outreach emails to landlords, employers, and university housing partners about SweetLease's corporate housing platform.

SweetLease connects independent landlords with relocating corporate employees. Key value props:
- For landlords: Fill vacancies 3x faster (7-14 days vs 30-45 days), pre-screened tenants with employer-backed lease guarantees, zero marketing spend
- For employers: Employees get $100-300/month rent savings, pre-verified landlords, move-in coordination, zero cost to employer
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
- Use a professional greeting with the lead's name (e.g., "Dear [First Name] [Last Name]"). Do NOT assume titles like "Dr." unless the lead's title explicitly contains "MD", "DO", "PhD", or "Dr."  - many contacts in medical settings are administrators, coordinators, or directors, not physicians.
- Reference specific details (city, property count, company, relocations, enrollment, off-campus %)
- ALWAYS offer TWO CTA options: a primary Calendly link AND a softer alternative for people who don't want a meeting
  - Primary Calendly links: https://calendly.com/sweetlease/intro (landlords), https://calendly.com/sweetlease/employer-intro (employers), or https://calendly.com/sweetlease/university-partnership (universities/residency/grad housing)
  - Soft alternatives: reference the ATTACHED partnership overview, one-pager, case study, or market report. Always frame documents as "I have attached"  - never ask them to reply for it. NEVER link to sweetlease.com/partners.
- Sign off with just "Best regards," and "Terrell Gilbert" on the next line. Do NOT include "SweetLease" in the sign-off text  - the email signature with logo and company info is appended automatically.
- IMPORTANT: When mentioning cost, emphasize that the service is FREE for the recipient's organization/program. We are waiving any fees as part of our partnership outreach. Never mention a $99.99 fee or any cost to the end user in outreach emails.
- Tone: Professional, polished, and business-appropriate. Write like a senior business development executive. Use complete sentences, proper grammar, and a respectful tone. Avoid slang, casual phrases, and colloquialisms.
- This is COLD outreach. You do NOT know the recipient. Never say "I know you" or "I noticed you" or presume any familiarity with their situation. Do not assume their pain points or claim knowledge of their challenges. Let the recipient decide if it applies.
- Never use "I hope this finds you well" or similar filler greetings. Get to the point quickly.
- Opening: Start with a brief, one-sentence introduction of who you are and why you're reaching out (e.g., "My name is Terrell Gilbert with SweetLease, and I'm reaching out regarding [specific reason relevant to their role]."). Keep it to one sentence, then immediately move into the value proposition. No fluff, no market stats preamble.
- The email should read as if addressed to someone in their specific role. Use the lead's title and organization context to tailor the message to what matters to THEM in their position, not a generic pitch.
- Never use exclamation marks excessively
- Vary subject lines - make them specific, professional, and relevant to the recipient's role`;

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

If a call is not ideal right now, I have attached a one-pager that covers how it works for landlords like you  - takes 2 minutes to read.

Best regards,
Terrell Gilbert`,
  },
  {
    subject: '{{company}} relocations - a better way',
    body: (lead: GenerateEmailRequest['lead']) => `Hi ${lead.name.split(' ')[0]},

Following up on my last note.

Corporate landlords fill vacancies 3x faster than independent landlords. Not because they have better properties, but because they have better distribution.

They're embedded in relocation networks. When a Tesla engineer moves to ${lead.city || 'Austin'}, corporate landlords hear about it weeks before that tenant starts browsing listings.

SweetLease gives you that same advantage.

Last month, we placed 47 relocating employees in ${lead.city || 'Texas'} properties. Average days to lease: 11.

Would it make sense to chat for 15 minutes? https://calendly.com/sweetlease/intro

No time for a call? I have attached a summary document with everything you need to know  - takes 2 minutes to read.

Best regards,
Terrell Gilbert`,
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

I have also attached a quick case study from a landlord in your market  - worth a look if you are short on time.

Best regards,
Terrell Gilbert`,
  },
  {
    subject: 'Should I close your file?',
    body: (lead: GenerateEmailRequest['lead']) => `Hi ${lead.name.split(' ')[0]},

I've reached out a few times about connecting your properties with relocating employees.

I know you're busy managing ${lead.properties || 'your'} properties, so I wanted to check if this is something worth exploring or if I should close your file for now.

Either way, no hard feelings. Just let me know.

If the timing is better later this year, I'm happy to reconnect then.

Best regards,
Terrell Gilbert`,
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

Not ready for a call? I have attached the details  - takes 2 minutes to read.

Best regards,
Terrell Gilbert`,
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

Would it be helpful to explore this? I can walk through it in 15 minutes: https://calendly.com/sweetlease/employer-intro

If a meeting does not work, I have attached a 2-page overview you can share with your team  - takes 2 minutes to read.

Best regards,
Terrell Gilbert`,
  },
  {
    subject: 'Reducing relocation friction for ${company} employees',
    body: (lead: GenerateEmailRequest['lead']) => `Hi ${lead.name?.split(' ')[0] || 'there'},

Following up on my previous note about housing support for relocating employees.

The #1 complaint we hear from HR teams: employees struggle to find quality housing fast enough, which delays start dates and hurts productivity.

SweetLease solves this by giving your employees first access to a network of landlords who specialize in corporate relocations.

The result? Your employees find housing 40% faster than through traditional channels.

Would a quick call make sense? https://calendly.com/sweetlease/employer-intro

If you would rather skip the call, I have attached a 2-page summary covering how we work with HR teams.

Best regards,
Terrell Gilbert`,
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

I have also attached the full case study for your reference.

Best regards,
Terrell Gilbert`,
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

Best regards,
Terrell Gilbert`,
  },
  {
    subject: 'Closing the loop on housing support',
    body: (lead: GenerateEmailRequest['lead']) => `Hi ${lead.name?.split(' ')[0] || 'there'},

This will be my last note about SweetLease's corporate housing solution.

If supporting ${lead.company || 'your'} relocating employees with faster, easier housing isn't a current priority, I completely understand.

If things change or you'd like to explore this down the road, I'm always happy to reconnect: https://calendly.com/sweetlease/employer-intro

Wishing you and the team continued success!

Best regards,
Terrell Gilbert`,
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

Would you be open to a 15-minute call? https://calendly.com/sweetlease/university-partnership

If a call is not ideal right now, I have attached a one-pager you can share with your team  - takes 2 minutes to read.

Best regards,
Terrell Gilbert`,
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

I have also attached a market report for your area  - worth a look if you are short on time.

Best regards,
Terrell Gilbert`,
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

I have attached an overview of how we support international students at other schools.

Best regards,
Terrell Gilbert`,
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

I have attached a sample of the co-branded housing guide for your reference.

Best regards,
Terrell Gilbert`,
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

Would it be possible to discuss getting involved in your next student housing event? https://calendly.com/sweetlease/university-partnership

If it is easier, just reply with the date of your next housing fair and I will send over a formal participation request.

Best regards,
Terrell Gilbert`,
  },
];

// ── RESIDENCY PROGRAM SEQUENCES ──
const RESIDENCY_SEQUENCES = [
  {
    subject: 'Housing support for incoming residents at {{orgName}}',
    body: (lead: GenerateEmailRequest['lead']) => `Hi ${lead.name?.split(' ')[0] || 'there'},

I'm reaching out because I know ${lead.orgName || 'your program'} brings in a new class of residents every July, and finding affordable housing in ${lead.city || 'a high-cost city'} is consistently one of the biggest stressors for incoming trainees.

SweetLease helps residents save 5-15% on rent through group negotiation  - we aggregate demand from incoming cohorts and negotiate directly with landlords near major medical centers.

For ${lead.orgName || 'your institution'}, this means:
- Incoming residents get pre-negotiated rent discounts before they arrive
- Zero cost to the program or institution
- One less thing for your GME office to worry about during onboarding

We're already working with residency programs in ${lead.state === 'NY' ? 'the New York metro area' : lead.state === 'MA' ? 'Boston' : lead.state === 'CA' ? 'California' : 'major metro areas'} and would love to extend this to your residents.

Would 15 minutes work to walk through how it works? https://calendly.com/sweetlease/university-partnership

If a call does not work with your schedule, I have attached a short overview you can share with your GME team.

Best regards,
Terrell Gilbert`,
  },
  {
    subject: 'Quick follow-up  - resident housing at {{orgName}}',
    body: (lead: GenerateEmailRequest['lead']) => `Hi ${lead.name?.split(' ')[0] || 'there'},

Following up on my note about housing support for your incoming residents.

Here's the reality: a PGY-1 making $60-65K in ${lead.city || 'a major city'} is spending 40-50% of gross income on rent. That's a retention problem disguised as a housing problem.

Programs that offer housing resources  - even just a recommended service  - see measurably better satisfaction scores from incoming classes.

SweetLease is free to recommend. We handle everything: negotiating with landlords near ${lead.orgName || 'your hospital'}, vetting properties, and coordinating move-ins timed to your July start date.

All we'd need is a brief intro to include SweetLease in your incoming resident welcome packet or housing resource page.

Worth a quick call? https://calendly.com/sweetlease/university-partnership

I have also attached a one-pager you can drop straight into your welcome packet.

Best regards,
Terrell Gilbert`,
  },
  {
    subject: 'How one program saved residents $3,200/year on housing',
    body: (lead: GenerateEmailRequest['lead']) => `Hi ${lead.name?.split(' ')[0] || 'there'},

One more note on this  - wanted to share a concrete example.

We worked with a residency program that had 45 incoming residents in a single match cycle. By aggregating their housing demand, we negotiated average savings of $267/month across the cohort  - that's $3,200/year per resident without anyone changing their housing preferences.

The program didn't pay anything. They simply added SweetLease to their pre-orientation materials and let us handle the rest.

I think we could do something similar for ${lead.orgName || 'your program'}'s incoming class. Even if it's just 15-20 residents, the group leverage makes a real difference.

If the timing isn't right for this cycle, I'm happy to reconnect before your next match. Just let me know either way.

I have attached a summary document that covers the full program  - worth a look if you do not have time for a call.

Best regards,
Terrell Gilbert`,
  },
];

// ── BENEFITS PLATFORM SEQUENCES ──
const BENEFITS_SEQUENCES = [
  {
    subject: 'New LSA category your clients are asking about',
    body: (lead: GenerateEmailRequest['lead']) => `Hi ${lead.name?.split(' ')[0] || 'there'},

I'm reaching out because ${lead.orgName || 'your platform'} is one of the leaders in employee benefits, and we've built something that fits naturally into your marketplace.

SweetLease is a housing benefit. Employees who rent  - especially those relocating  - get access to group-negotiated rent discounts that save $100-300/month. It works like a buying group for housing.

For ${lead.orgName || 'your platform'}, this means:
- A new benefit category that no other LSA/benefits platform offers yet
- High engagement  - housing is a top-3 expense for every employee
- Simple integration  - we handle the negotiation, your platform gets a new category

We're looking for one benefits platform partner to launch with. Given ${lead.orgName || 'your'} position in the market, you'd be first to offer this.

Would 20 minutes work to explore the partnership model? https://calendly.com/sweetlease/employer-intro

If a meeting does not make sense yet, I have attached a short deck on the integration model.

Best regards,
Terrell Gilbert`,
  },
  {
    subject: 'Housing is the benefit gap  - here\'s the data',
    body: (lead: GenerateEmailRequest['lead']) => `Hi ${lead.name?.split(' ')[0] || 'there'},

Following up on my note about adding housing as a benefit category on ${lead.orgName || 'your platform'}.

Some context: 35% of employees say housing costs are their #1 financial stressor, ahead of healthcare and retirement. Yet no major benefits platform offers a housing benefit beyond relocation stipends.

SweetLease fills that gap. We aggregate employee demand by geography and negotiate group rates with landlords  - the same leverage that corporate housing companies use, but accessible to individual employees.

The model for ${lead.orgName || 'your platform'}:
- White-label or co-branded integration
- Zero cost to integrate  - we handle all landlord relationships and negotiation

Your clients get a differentiating benefit. Their employees save real money. You add a category nobody else has.

Can we explore this for 20 minutes? https://calendly.com/sweetlease/employer-intro

I have attached the full housing benefit research with the partnership model for your review.

Best regards,
Terrell Gilbert`,
  },
  {
    subject: 'Last note  - partnership window closing',
    body: (lead: GenerateEmailRequest['lead']) => `Hi ${lead.name?.split(' ')[0] || 'there'},

Last note on this  - we're finalizing our benefits platform partnership for Q2 launch and I wanted to give ${lead.orgName || 'your team'} a final opportunity to explore it.

The short version: SweetLease is a housing benefit that saves renters $100-300/month through group negotiation. We're looking for one platform partner to co-launch with, which means exclusive positioning in the housing benefit category for the launch period.

If the timing isn't right, I completely understand. But if there's someone on your partnerships or product team who'd want to evaluate this, I'm happy to connect with them directly.

Either way, no hard feelings. Just let me know.

https://calendly.com/sweetlease/employer-intro

Best regards,
Terrell Gilbert`,
  },
];

// ── GRADUATE HOUSING SEQUENCES ──
const GRADUATE_HOUSING_SEQUENCES = [
  {
    subject: 'Free off-campus housing resource for {{orgName}} students',
    body: (lead: GenerateEmailRequest['lead']) => `Hi ${lead.name?.split(' ')[0] || 'there'},

I'm reaching out because ${lead.orgName || 'your university'}'s students face some of the highest off-campus housing costs in the country, and we've built a tool that directly addresses this.

SweetLease helps students save 5-15% on rent through group negotiation. We aggregate demand from students at the same school and negotiate directly with landlords in the neighborhoods around campus.

For ${lead.orgName || 'your housing office'}:
- Zero cost  - we're a free resource you can recommend to students
- Pre-vetted landlords within commuting distance of campus
- Especially valuable for grad and international students arriving mid-year

We're already working with housing offices at universities in ${lead.state === 'NY' ? 'New York' : lead.state === 'CA' ? 'California' : lead.state === 'MA' ? 'Massachusetts' : 'major metro areas'} and would love to be a resource for ${lead.orgName || 'your'} students too.

Would 15 minutes work to walk through it? https://calendly.com/sweetlease/university-partnership

If a call is not ideal right now, I have attached a quick overview you can share with your team.

Best regards,
Terrell Gilbert`,
  },
  {
    subject: 'Rent data near {{orgName}}  - thought this would be useful',
    body: (lead: GenerateEmailRequest['lead']) => `Hi ${lead.name?.split(' ')[0] || 'there'},

Following up on my note about SweetLease as a housing resource for ${lead.orgName || 'your'} students.

I pulled some data that might be relevant: off-campus rents within 2 miles of ${lead.orgName || 'campus'} have increased 14% year-over-year. For students already stretching budgets, that's a real problem.

SweetLease addresses this by negotiating group rates with landlords near campus. When 20+ students are looking in the same area at the same time, we use that collective leverage to secure $100-250/month below market rate.

We'd be happy to:
- Share a full ${lead.city || 'local'} market report with your team (no strings attached)
- Be listed as a recommended resource on your housing website
- Present at orientation or a housing information session

Any of those work for your office? https://calendly.com/sweetlease/university-partnership

I have attached relevant materials for each option  - no call needed.

Best regards,
Terrell Gilbert`,
  },
  {
    subject: 'Closing the loop  - housing partnership with {{orgName}}',
    body: (lead: GenerateEmailRequest['lead']) => `Hi ${lead.name?.split(' ')[0] || 'there'},

One last note on this  - I've reached out a couple of times about SweetLease as a free off-campus housing resource for ${lead.orgName || 'your'} students.

If it's not the right time or not a fit, I totally understand. Housing partnerships are a newer concept and I know your office juggles a lot.

If you'd like to revisit this before the next academic cycle (when incoming students are scrambling for housing), I'm happy to reconnect then. Just say the word.

Either way, wishing you and the ${lead.orgName || 'your university'} team a great semester.

Best regards,
Terrell Gilbert`,
  },
];

async function generateWithAI(lead: GenerateEmailRequest['lead'], leadType: string, emailNumber: number): Promise<{ subject: string; body: string } | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const client = new Anthropic({ apiKey });
    const sequenceNames = leadType === 'residency'
      ? ['Program Introduction', 'Follow-Up with Value', 'Case Study + Breakup']
      : leadType === 'benefits-platform'
      ? ['Partnership Intro', 'Data + Model', 'Final Window']
      : leadType === 'graduate-housing'
      ? ['Housing Office Intro', 'Market Data Follow-Up', 'Breakup']
      : leadType === 'university'
      ? ['Housing Office Intro', 'Follow-Up with Data', 'International Student Office', 'Graduate Association', 'Housing Fair Booth']
      : ['Hook', 'Social Proof', 'ROI', 'Urgency', 'Breakup'];

    const leadContext = leadType === 'residency'
      ? `Residency Program Contact: ${lead.name}, ${lead.title || 'GME Coordinator'} at ${lead.orgName || 'a teaching hospital'} in ${lead.city || 'unknown city'}${lead.state ? ', ' + lead.state : ''}. Organization has ${lead.orgEmployeeCount ? lead.orgEmployeeCount.toLocaleString() + ' employees' : 'unknown employee count'}. Key pain point: incoming residents struggle with housing costs in high-cost cities, affecting recruitment and retention.`
      : leadType === 'benefits-platform'
      ? `Benefits Platform Contact: ${lead.name}, ${lead.title || 'Head of Partnerships'} at ${lead.orgName || 'a benefits platform'} in ${lead.city || 'unknown city'}${lead.state ? ', ' + lead.state : ''}. Company is in the ${lead.industry || 'HR tech/employee benefits'} space with ${lead.orgEmployeeCount ? lead.orgEmployeeCount + ' employees' : 'unknown size'}. Pitch: housing as a new LSA/benefit category  - first-mover advantage.`
      : leadType === 'graduate-housing'
      ? `University Housing Contact: ${lead.name}, ${lead.title || 'Director of Housing'} at ${lead.orgName || 'a university'} in ${lead.city || 'unknown city'}${lead.state ? ', ' + lead.state : ''}. Key pain point: students face high off-campus housing costs. SweetLease is a free resource the housing office can recommend.`
      : leadType === 'landlord'
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
    const sequences = leadType === 'residency' ? RESIDENCY_SEQUENCES
      : leadType === 'benefits-platform' ? BENEFITS_SEQUENCES
      : leadType === 'graduate-housing' ? GRADUATE_HOUSING_SEQUENCES
      : leadType === 'landlord' ? LANDLORD_SEQUENCES
      : leadType === 'university' ? UNIVERSITY_SEQUENCES
      : EMPLOYER_SEQUENCES;
    const index = Math.min(emailNumber - 1, sequences.length - 1);
    const template = sequences[index];

    let subject = template.subject
      .replace('{{company}}', lead.company || lead.name)
      .replace('{{university}}', lead.university || lead.name)
      .replace('{{orgName}}', lead.orgName || lead.company || lead.name)
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
