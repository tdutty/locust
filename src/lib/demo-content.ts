// ─── Audience-specific content for the self-service demo walkthrough ─────────

export type AudienceType = 'landlord' | 'employer' | 'university' | 'residency' | 'benefits-platform' | 'graduate-housing';

export interface QuestionOption {
  label: string;
  value: string;
}

export interface DemoQuestion {
  id: string;
  label: string;
  options: QuestionOption[];
  multiSelect?: boolean;
}

export interface ValueProp {
  icon: 'dollar' | 'clock' | 'shield' | 'users' | 'chart' | 'building';
  title: string;
  description: string;
}

export interface SlideContent {
  image: string;
  title: string;
  highlight: string;
  caption: string;
}

export interface PainPointOption {
  label: string;
  value: string;
}

export interface AudienceContent {
  badge: string;
  painStat: string;
  painHeadline: string;
  questions: DemoQuestion[];
  slides: SlideContent[];
  valueProps: ValueProp[];
  painPointQuestion: string;
  painPointOptions: PainPointOption[];
  solutionHeadline: string;
  estimateLabel: string;
  estimateUnit: string;
  estimateDescription: string;
  estimateComparison: string;
}

// ─── Estimate calculation ──────────────────────────────────────────────────

export function calculateEstimate(
  audienceType: AudienceType,
  answers: Record<string, string | string[]>,
): number {
  switch (audienceType) {
    case 'landlord': {
      const unitsMap: Record<string, number> = { '1-10': 5, '11-50': 30, '51-200': 100, '200+': 250 };
      const units = unitsMap[answers.units as string] || 30;
      // vacancy_days_saved estimated at 30 days, $60/day
      return units * 30 * 60;
    }
    case 'employer': {
      const reloMap: Record<string, number> = { '1-10': 5, '11-50': 30, '51-200': 100, '200+': 250 };
      const relocations = reloMap[answers.relocations as string] || 30;
      return relocations * 200 * 12;
    }
    case 'university': {
      const studentMap: Record<string, number> = { 'Under 5k': 3000, '5-15k': 10000, '15-30k': 22000, '30k+': 35000 };
      const offCampusMap: Record<string, number> = { '<25%': 0.15, '25-50%': 0.375, '50-75%': 0.625, '75%+': 0.85 };
      const students = studentMap[answers.student_body as string] || 10000;
      const offCampus = offCampusMap[answers.off_campus as string] || 0.5;
      return Math.round(students * offCampus * 150 * 9);
    }
    case 'residency': {
      const cohortMap: Record<string, number> = { 'Under 10': 7, '10-30': 20, '30-60': 45, '60+': 75 };
      const cohort = cohortMap[answers.cohort_size as string] || 20;
      return cohort * 267 * 12;
    }
    case 'benefits-platform': {
      const empMap: Record<string, number> = { 'Under 10k': 5000, '10-50k': 30000, '50-200k': 100000, '200k+': 250000 };
      const employees = empMap[answers.employees_served as string] || 30000;
      return Math.round(employees * 0.35 * 150 * 12);
    }
    case 'graduate-housing': {
      const gradMap: Record<string, number> = { 'Under 1k': 500, '1-5k': 3000, '5-15k': 10000, '15k+': 20000 };
      const offCampusMap: Record<string, number> = { '<25%': 0.15, '25-50%': 0.375, '50-75%': 0.625, '75%+': 0.85 };
      const grads = gradMap[answers.grad_students as string] || 3000;
      const offCampus = offCampusMap[answers.off_campus as string] || 0.5;
      return Math.round(grads * offCampus * 125 * 9);
    }
    default:
      return 50000;
  }
}

// ─── Content per audience ──────────────────────────────────────────────────

export const DEMO_CONTENT: Record<AudienceType, AudienceContent> = {
  landlord: {
    badge: 'Landlord Partnership',
    painStat: '$1,800–3,600 lost per vacant unit every month',
    painHeadline: 'Every empty unit costs you money',
    questions: [
      {
        id: 'units',
        label: 'How many units do you manage?',
        options: [
          { label: '1–10', value: '1-10' },
          { label: '11–50', value: '11-50' },
          { label: '51–200', value: '51-200' },
          { label: '200+', value: '200+' },
        ],
      },
      {
        id: 'time_to_fill',
        label: 'What\'s your average time-to-fill?',
        options: [
          { label: 'Under 2 weeks', value: '<2wk' },
          { label: '2–4 weeks', value: '2-4wk' },
          { label: '1–2 months', value: '1-2mo' },
          { label: '2+ months', value: '2+mo' },
        ],
      },
    ],
    slides: [
      {
        image: '/demo/marketplace.png?v=3',
        title: 'Your Listings, Thousands of Pre-Qualified Tenants',
        highlight: '3x more applications vs. traditional listings',
        caption: 'Your properties are featured to employer-backed tenants who are relocating and ready to sign. "Best Deal" badges and group discounts drive applications — no advertising spend required. These aren\'t tire-kickers; they\'re corporate-backed renters with guaranteed income.',
      },
      {
        image: '/demo/verification.png?v=2',
        title: 'Every Tenant Pre-Screened Before They Apply',
        highlight: 'Zero eviction risk from SweetLease tenants',
        caption: 'Our 4-step verification pipeline handles everything: identity verification, background check, credit score, and income proof. You never waste time showing units to unqualified applicants. Every lead that reaches you is verified, employed, and ready to move.',
      },
      {
        image: '/demo/dashboard.png?v=2',
        title: 'Real-Time Portfolio Performance',
        highlight: 'Full visibility into every unit',
        caption: 'Track revenue per unit, days on market, occupancy rates, and conversion metrics in real time. See which properties perform best, identify bottlenecks, and make data-driven decisions — no spreadsheets, no guesswork.',
      },
    ],
    valueProps: [
      { icon: 'clock', title: 'Fill vacancies 3x faster', description: 'Pre-screened, employer-backed tenants ready to sign in 7–14 days instead of 45+.' },
      { icon: 'shield', title: 'Corporate-backed leases', description: 'Employer guarantees eliminate default risk. Every tenant has verified income and a corporate sponsor.' },
      { icon: 'dollar', title: 'Zero cost to you', description: 'No listing fees, no advertising spend, no commission. We bring qualified tenants directly to your door.' },
    ],
    painPointQuestion: 'What\'s your biggest challenge right now?',
    painPointOptions: [
      { label: 'Long vacancy periods', value: 'vacancy' },
      { label: 'Finding quality tenants', value: 'tenant_quality' },
      { label: 'Marketing costs', value: 'marketing_costs' },
      { label: 'Lease defaults', value: 'lease_defaults' },
    ],
    solutionHeadline: 'Here\'s how SweetLease fills your units faster',
    estimateLabel: 'Your estimated annual savings',
    estimateUnit: '',
    estimateDescription: 'Based on reducing average vacancy from 45 to 14 days across your portfolio.',
    estimateComparison: 'Landlords on SweetLease fill vacancies 3x faster with zero marketing spend.',
  },

  employer: {
    badge: 'Employer Housing Program',
    painStat: '68% of employees say housing stress delays their productivity after relocation',
    painHeadline: 'Housing is the #1 relocation bottleneck',
    questions: [
      {
        id: 'relocations',
        label: 'How many employees relocate per year?',
        options: [
          { label: '1–10', value: '1-10' },
          { label: '11–50', value: '11-50' },
          { label: '51–200', value: '51-200' },
          { label: '200+', value: '200+' },
        ],
      },
      {
        id: 'current_process',
        label: 'How do you handle relocation housing today?',
        options: [
          { label: 'Employee handles it', value: 'employee_handles' },
          { label: 'Relocation company', value: 'relo_company' },
          { label: 'Internal team', value: 'internal' },
          { label: 'No formal process', value: 'no_process' },
        ],
      },
    ],
    slides: [
      {
        image: '/demo/marketplace.png?v=3',
        title: 'Move-In Ready Housing, Below Market Rate',
        highlight: '15–25% below market rent',
        caption: 'Your relocating employees get instant access to curated, verified apartments at group-negotiated rates. No Zillow browsing, no scam listings, no stress — just move-in ready housing waiting for them before they arrive. Average savings: $200/month per employee.',
      },
      {
        image: '/demo/verification.png?v=2',
        title: 'Every Property Verified for Safety & Quality',
        highlight: '4-step verification eliminates risk',
        caption: 'Identity, background check, credit, and income verification protect your employees from unsafe or fraudulent listings. Companies lose an average of $12,000 per failed relocation — our verification pipeline ensures your employees land in quality, safe housing every time.',
      },
      {
        image: '/demo/dashboard.png?v=2',
        title: 'HR Dashboard: Track Every Relocation',
        highlight: 'Real-time placement tracking',
        caption: 'Your HR team gets full visibility: placement speed, employee satisfaction scores, and total cost savings. Track every relocation from offer letter to move-in day. Generate reports for leadership showing ROI on your housing benefit.',
      },
    ],
    valueProps: [
      { icon: 'dollar', title: 'Zero cost to your organization', description: 'SweetLease is completely free for employers. We make money from landlord partnerships — you pay nothing.' },
      { icon: 'users', title: 'Employees save $200+/month', description: 'Group negotiation and pre-market access gets your team rates they can\'t find on their own.' },
      { icon: 'clock', title: 'Placed in days, not weeks', description: 'Pre-vetted, move-in ready housing means employees start producing faster. Average placement: 7 days.' },
    ],
    painPointQuestion: 'What\'s the biggest pain point for relocating employees?',
    painPointOptions: [
      { label: 'Finding housing fast', value: 'speed' },
      { label: 'Costs too high', value: 'cost' },
      { label: 'Unfamiliar with area', value: 'unfamiliar' },
      { label: 'Lack of support', value: 'support' },
    ],
    solutionHeadline: 'Here\'s how SweetLease supports your team',
    estimateLabel: 'Estimated annual employee savings',
    estimateUnit: '',
    estimateDescription: 'Based on average $200/mo savings per relocating employee across your organization.',
    estimateComparison: 'Companies using SweetLease reduce relocation housing time by 40% and save $2,400+ per employee annually.',
  },

  university: {
    badge: 'University Partnership',
    painStat: 'Off-campus rents have increased 12% year-over-year — students are being priced out',
    painHeadline: 'Your students can\'t afford to live near campus',
    questions: [
      {
        id: 'student_body',
        label: 'What\'s your total student body size?',
        options: [
          { label: 'Under 5,000', value: 'Under 5k' },
          { label: '5,000–15,000', value: '5-15k' },
          { label: '15,000–30,000', value: '15-30k' },
          { label: '30,000+', value: '30k+' },
        ],
      },
      {
        id: 'off_campus',
        label: 'What percentage live off-campus?',
        options: [
          { label: 'Under 25%', value: '<25%' },
          { label: '25–50%', value: '25-50%' },
          { label: '50–75%', value: '50-75%' },
          { label: '75%+', value: '75%+' },
        ],
      },
    ],
    slides: [
      {
        image: '/demo/marketplace.png?v=3',
        title: 'Curated Housing Near Campus at Group Rates',
        highlight: '15–25% below market rent',
        caption: 'Students browse verified, move-in ready apartments near your campus — all at group-negotiated rates they can\'t find anywhere else. No predatory landlords, no scam listings. Your housing office can recommend this with confidence.',
      },
      {
        image: '/demo/verification.png?v=2',
        title: 'Every Listing Verified for Student Safety',
        highlight: 'Background-checked landlords & properties',
        caption: 'Our 4-step verification ensures every property meets quality and safety standards. Identity checks, background screening, and property verification protect your students from the fraud and unsafe conditions that plague off-campus housing.',
      },
      {
        image: '/demo/dashboard.png?v=2',
        title: 'Housing Office Command Center',
        highlight: 'Monitor all student placements',
        caption: 'Your housing office gets a real-time dashboard to track student placement rates, average savings, and satisfaction scores. Generate reports for administration showing the impact of your housing partnership — measurable, data-driven results.',
      },
    ],
    valueProps: [
      { icon: 'dollar', title: 'Zero cost to the university', description: 'A completely free housing resource your office can recommend with confidence. We\'re funded by landlord partnerships.' },
      { icon: 'building', title: '15–25% below market rents', description: 'Bulk negotiation power from your student body creates real savings — $150/mo average per student.' },
      { icon: 'shield', title: 'Pre-vetted, safe housing', description: 'Every listing is verified. Background-checked landlords, inspected properties, and quality guarantees protect your students.' },
    ],
    painPointQuestion: 'What\'s the top housing concern for your students?',
    painPointOptions: [
      { label: 'Affordability', value: 'affordability' },
      { label: 'Safety & quality', value: 'safety' },
      { label: 'Availability near campus', value: 'availability' },
      { label: 'International student needs', value: 'international' },
    ],
    solutionHeadline: 'Here\'s how SweetLease helps your students',
    estimateLabel: 'Potential annual student savings',
    estimateUnit: '',
    estimateDescription: 'Based on average $150/mo savings for off-campus students over 9 months.',
    estimateComparison: 'Partner universities see 90%+ student satisfaction and measurable retention improvements.',
  },

  residency: {
    badge: 'Residency Program Partnership',
    painStat: 'PGY-1 residents spend 40–50% of gross income on rent — the highest cost burden of any profession',
    painHeadline: 'Your residents can\'t afford housing on trainee salaries',
    questions: [
      {
        id: 'cohort_size',
        label: 'How large is your incoming cohort?',
        options: [
          { label: 'Under 10', value: 'Under 10' },
          { label: '10–30', value: '10-30' },
          { label: '30–60', value: '30-60' },
          { label: '60+', value: '60+' },
        ],
      },
      {
        id: 'current_resources',
        label: 'What housing resources do you currently provide?',
        options: [
          { label: 'Welcome packet', value: 'welcome_packet' },
          { label: 'Recommended list', value: 'recommended_list' },
          { label: 'Nothing formal', value: 'nothing' },
          { label: 'Other', value: 'other' },
        ],
      },
    ],
    slides: [
      {
        image: '/demo/marketplace.png?v=3',
        title: 'Hospital-Adjacent Housing at Cohort Rates',
        highlight: '$267/mo average savings per resident',
        caption: 'Incoming residents browse verified apartments near your hospital at group-negotiated rates. Move-in dates coordinated with your July start. No more residents scrambling to find housing in an unfamiliar city while starting the hardest job of their lives.',
      },
      {
        image: '/demo/verification.png?v=2',
        title: 'Safe, Verified Housing for Your Trainees',
        highlight: 'Every property background-checked',
        caption: 'Our 4-step verification process ensures your residents — who are too busy with 80-hour weeks to research landlords — only see safe, quality-verified properties. Identity, background, credit, and property inspections are all handled.',
      },
      {
        image: '/demo/dashboard.png?v=2',
        title: 'Program Dashboard: Placement & Savings',
        highlight: 'Track your entire incoming class',
        caption: 'Your GME office gets visibility into how many residents are placed, average savings per resident, and satisfaction scores. Use this data in recruitment materials — "our program provides housing support" is a real differentiator.',
      },
    ],
    valueProps: [
      { icon: 'dollar', title: 'Free for programs & residents', description: 'Completely free. We negotiate with landlords on your residents\' behalf — no cost to anyone on your side.' },
      { icon: 'users', title: '$267/mo average savings', description: 'Cohort leverage creates real results. That\'s $3,200/year back in residents\' pockets on trainee salaries.' },
      { icon: 'clock', title: 'Timed to your July start', description: 'We coordinate everything around your program schedule. Residents have housing secured before orientation day.' },
    ],
    painPointQuestion: 'What matters most for your incoming class?',
    painPointOptions: [
      { label: 'Affordable options', value: 'affordability' },
      { label: 'Proximity to hospital', value: 'proximity' },
      { label: 'Turnkey move-in', value: 'turnkey' },
      { label: 'Better recruitment tool', value: 'recruitment' },
    ],
    solutionHeadline: 'Here\'s how SweetLease supports your residents',
    estimateLabel: 'Estimated annual cohort savings',
    estimateUnit: '',
    estimateDescription: 'Based on average $267/mo savings per resident over 12 months.',
    estimateComparison: 'Programs using SweetLease report higher match satisfaction and use housing support as a recruitment advantage.',
  },

  'benefits-platform': {
    badge: 'Benefits Platform Partnership',
    painStat: '35% of employees say housing is their #1 financial stressor — yet no benefits platform addresses it',
    painHeadline: 'Housing is the missing benefit category',
    questions: [
      {
        id: 'employees_served',
        label: 'How many employees does your platform serve?',
        options: [
          { label: 'Under 10,000', value: 'Under 10k' },
          { label: '10,000–50,000', value: '10-50k' },
          { label: '50,000–200,000', value: '50-200k' },
          { label: '200,000+', value: '200k+' },
        ],
      },
      {
        id: 'benefit_categories',
        label: 'Which benefit categories do you currently offer?',
        multiSelect: true,
        options: [
          { label: 'Health & wellness', value: 'health' },
          { label: 'Financial planning', value: 'financial' },
          { label: 'Commuter benefits', value: 'commuter' },
          { label: 'Family care', value: 'family' },
        ],
      },
    ],
    slides: [
      {
        image: '/demo/marketplace.png?v=3',
        title: 'White-Label Housing Marketplace',
        highlight: 'First-mover advantage in housing benefits',
        caption: 'Embed a fully branded housing marketplace into your platform. Employees search verified, discounted apartments without leaving your ecosystem. No other benefits platform offers this — you\'d be the first, and that\'s a competitive moat.',
      },
      {
        image: '/demo/verification.png?v=2',
        title: 'Built-In Compliance & Verification',
        highlight: 'Zero additional compliance work',
        caption: 'Our verification pipeline handles everything: identity, background, credit, and income checks. Your compliance team doesn\'t need to touch it. Full audit trail, SOC 2 compliant infrastructure, and enterprise-grade security.',
      },
      {
        image: '/demo/dashboard.png?v=2',
        title: 'Enterprise Analytics & Reporting',
        highlight: 'Prove ROI to your clients',
        caption: 'Track engagement, utilization, savings, and satisfaction across your entire employee base. White-labeled dashboards let your clients see the impact. This isn\'t just a benefit — it\'s a measurable, reportable program.',
      },
    ],
    valueProps: [
      { icon: 'chart', title: 'First-mover advantage', description: 'No major benefits platform offers housing. Be first to market with the benefit employees want most.' },
      { icon: 'dollar', title: 'Employees save $100–300/mo', description: 'Group negotiation delivers real, measurable savings on the #1 household expense.' },
      { icon: 'building', title: 'White-label or co-brand', description: 'We handle all landlord relationships and verification. You get a turnkey benefit to offer your clients.' },
    ],
    painPointQuestion: 'What would drive the most value for your clients?',
    painPointOptions: [
      { label: 'New benefit category', value: 'new_category' },
      { label: 'Employee engagement', value: 'engagement' },
      { label: 'Cost savings for employees', value: 'savings' },
      { label: 'Competitive differentiation', value: 'differentiation' },
    ],
    solutionHeadline: 'Here\'s how SweetLease fits your platform',
    estimateLabel: 'Potential annual savings across your platform',
    estimateUnit: '',
    estimateDescription: 'Based on 35% renter rate and $150/mo average savings per employee.',
    estimateComparison: 'Housing is the #1 expense for 35% of your users — and you can solve it without any operational lift.',
  },

  'graduate-housing': {
    badge: 'Graduate Housing Partnership',
    painStat: 'Graduate students face mid-year arrivals, stipend budgets, and zero institutional support',
    painHeadline: 'Grad students are on their own for housing',
    questions: [
      {
        id: 'grad_students',
        label: 'How many graduate students are enrolled?',
        options: [
          { label: 'Under 1,000', value: 'Under 1k' },
          { label: '1,000–5,000', value: '1-5k' },
          { label: '5,000–15,000', value: '5-15k' },
          { label: '15,000+', value: '15k+' },
        ],
      },
      {
        id: 'off_campus',
        label: 'What percentage live off-campus?',
        options: [
          { label: 'Under 25%', value: '<25%' },
          { label: '25–50%', value: '25-50%' },
          { label: '50–75%', value: '50-75%' },
          { label: '75%+', value: '75%+' },
        ],
      },
    ],
    slides: [
      {
        image: '/demo/marketplace.png?v=3',
        title: 'Grad-Friendly Housing at Group Rates',
        highlight: '$125/mo average savings',
        caption: 'Graduate students browse curated apartments near campus at rates negotiated specifically for stipend budgets. Flexible lease terms accommodate mid-year arrivals, visiting scholars, and non-standard academic calendars.',
      },
      {
        image: '/demo/verification.png?v=2',
        title: 'Every Listing Verified for Safety',
        highlight: 'Background-checked landlords & properties',
        caption: 'International students, first-time renters, and out-of-state arrivals are especially vulnerable to housing scams. Our verification pipeline protects them: identity checks, background screening, credit verification, and property inspections.',
      },
      {
        image: '/demo/dashboard.png?v=2',
        title: 'Graduate Housing Office Dashboard',
        highlight: 'Track placements & savings',
        caption: 'Your graduate housing office gets real-time visibility into placement rates, student savings, and satisfaction. Generate reports for the provost showing measurable impact — a data-driven argument for continued funding.',
      },
    ],
    valueProps: [
      { icon: 'dollar', title: 'Zero cost to the university', description: 'A free resource your graduate office can promote immediately. We\'re funded by landlord partnerships.' },
      { icon: 'building', title: '$125/mo average savings', description: 'Group rates negotiated specifically for grad student budgets. That\'s $1,125/year back per student.' },
      { icon: 'clock', title: 'Flexible move-in timing', description: 'We accommodate mid-year arrivals, visiting scholars, and non-standard lease terms that traditional platforms don\'t support.' },
    ],
    painPointQuestion: 'What\'s the biggest housing challenge for grad students?',
    painPointOptions: [
      { label: 'Affordability on stipends', value: 'affordability' },
      { label: 'Mid-year arrival timing', value: 'timing' },
      { label: 'Quality near campus', value: 'quality' },
      { label: 'International student needs', value: 'international' },
    ],
    solutionHeadline: 'Here\'s how SweetLease supports your grad students',
    estimateLabel: 'Potential annual grad student savings',
    estimateUnit: '',
    estimateDescription: 'Based on average $125/mo savings for off-campus grads over 9 months.',
    estimateComparison: 'Grad schools with SweetLease partnerships report measurable improvements in student satisfaction and retention.',
  },
};

// ─── Timeline options (shared across all audiences) ──────────────────────

export const TIMELINE_OPTIONS: QuestionOption[] = [
  { label: 'Immediately', value: 'immediately' },
  { label: 'Within 30 days', value: 'within_30_days' },
  { label: 'Next quarter', value: 'next_quarter' },
  { label: 'Just exploring', value: 'just_exploring' },
];

// ─── Map audience type to friendly label ─────────────────────────────────

export const AUDIENCE_LABEL: Record<string, string> = {
  landlord: 'Landlord Partnership',
  employer: 'Employer Housing Program',
  university: 'University Partnership',
  residency: 'Residency Program Partnership',
  'benefits-platform': 'Benefits Platform Partnership',
  'graduate-housing': 'Graduate Housing Partnership',
};
