import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// University partnership contacts from the SweetLease University Partnership Playbook
// Organized by tier based on strategic priority

interface UniversityContact {
  id: string;
  university: string;
  city: string;
  state: string;
  tier: 1 | 2 | 3;
  enrollment: string;
  offCampusPercent: string;
  avgRent: string;
  contactRole: string;
  contactName: string;
  contactEmail: string;
  contactDepartment: string;
  score: number;
  status: 'prospect' | 'contacted' | 'meeting_scheduled' | 'terms_proposed' | 'active' | 'renewed';
  partnershipType: 'housing_office' | 'international_office' | 'grad_association' | 'career_services' | 'dean_of_students';
  notes: string;
  source: string;
}

function getUniversityContacts(): UniversityContact[] {
  return [
    // TIER 1: Launch Markets (Months 1-6)
    {
      id: 'u1', university: 'New York University', city: 'New York', state: 'NY', tier: 1,
      enrollment: '50,000+', offCampusPercent: '~85%', avgRent: '$4,795/mo',
      contactRole: 'Director of Off-Campus Housing', contactName: 'Director - NYU Off-Campus Living',
      contactEmail: 'offcampus@nyu.edu', contactDepartment: 'Student Affairs / Housing',
      score: 98, status: 'prospect', partnershipType: 'housing_office',
      notes: 'Highest rents in the US; dense urban campus; large international student population. Priority target.',
      source: 'playbook'
    },
    {
      id: 'u2', university: 'NYU - International Student Office', city: 'New York', state: 'NY', tier: 1,
      enrollment: '50,000+', offCampusPercent: '~85%', avgRent: '$4,795/mo',
      contactRole: 'International Student Office Director', contactName: 'Director - NYU OGS',
      contactEmail: 'ogs@nyu.edu', contactDepartment: 'International Programs',
      score: 95, status: 'prospect', partnershipType: 'international_office',
      notes: 'International students face unique challenges: no US credit history, unfamiliar with lease norms. SweetLease verification solves this.',
      source: 'playbook'
    },
    {
      id: 'u3', university: 'Columbia University', city: 'New York', state: 'NY', tier: 1,
      enrollment: '33,000+', offCampusPercent: '~70%', avgRent: '$1,500-2,800/mo',
      contactRole: 'Director of Off-Campus Housing', contactName: 'Director - Columbia Off-Campus Housing',
      contactEmail: 'housing@columbia.edu', contactDepartment: 'Student Affairs / Housing',
      score: 94, status: 'prospect', partnershipType: 'housing_office',
      notes: 'Ivy League credibility signal; expensive NYC market; grad-heavy population.',
      source: 'playbook'
    },
    {
      id: 'u4', university: 'Columbia - Graduate Student Council', city: 'New York', state: 'NY', tier: 1,
      enrollment: '33,000+', offCampusPercent: '~70%', avgRent: '$1,500-2,800/mo',
      contactRole: 'GSA President', contactName: 'President - Columbia GSAC',
      contactEmail: 'gsac@columbia.edu', contactDepartment: 'Student Government',
      score: 88, status: 'prospect', partnershipType: 'grad_association',
      notes: 'Grad students are 25-35, higher income, longer tenure (2-6 years). Ideal power users.',
      source: 'playbook'
    },
    {
      id: 'u5', university: 'UC Berkeley', city: 'Berkeley', state: 'CA', tier: 1,
      enrollment: '45,000+', offCampusPercent: '~80%', avgRent: '$2,500+/mo',
      contactRole: 'Director of Off-Campus Housing', contactName: 'Director - Cal Off-Campus Housing',
      contactEmail: 'och@berkeley.edu', contactDepartment: 'Student Affairs / Housing',
      score: 96, status: 'prospect', partnershipType: 'housing_office',
      notes: 'Bay Area premium market; severe supply shortage; tech-forward students.',
      source: 'playbook'
    },
    {
      id: 'u6', university: 'UCLA', city: 'Los Angeles', state: 'CA', tier: 1,
      enrollment: '45,000+', offCampusPercent: '~75%', avgRent: '$5,158/mo',
      contactRole: 'Director of Off-Campus Housing', contactName: 'Director - UCLA Off-Campus Housing',
      contactEmail: 'och@ucla.edu', contactDepartment: 'Student Affairs / Housing',
      score: 95, status: 'prospect', partnershipType: 'housing_office',
      notes: 'Extreme rents ($5,158/mo avg); wealthy demographics; high tech adoption.',
      source: 'playbook'
    },
    {
      id: 'u7', university: 'UT Austin', city: 'Austin', state: 'TX', tier: 1,
      enrollment: '51,800+', offCampusPercent: '~83%', avgRent: '$1,400+/mo',
      contactRole: 'Director of Off-Campus Housing', contactName: 'Director - UT Off-Campus Student Services',
      contactEmail: 'offcampus@utexas.edu', contactDepartment: 'Student Affairs / Housing',
      score: 93, status: 'prospect', partnershipType: 'housing_office',
      notes: 'Massive off-campus population (42K+); fast-growing expensive Austin market. Synergy with existing SweetLease Austin presence.',
      source: 'playbook'
    },
    {
      id: 'u8', university: 'Boston University', city: 'Boston', state: 'MA', tier: 1,
      enrollment: '37,000+', offCampusPercent: '~65%', avgRent: '$2,200+/mo',
      contactRole: 'Director of Off-Campus Housing', contactName: 'Director - BU Off-Campus Services',
      contactEmail: 'offcampus@bu.edu', contactDepartment: 'Student Affairs / Housing',
      score: 90, status: 'prospect', partnershipType: 'housing_office',
      notes: 'Urban campus; extremely expensive Boston market; tech-savvy student body.',
      source: 'playbook'
    },

    // TIER 2: Volume Markets (Months 4-9)
    {
      id: 'u9', university: 'Arizona State University', city: 'Tempe', state: 'AZ', tier: 2,
      enrollment: '145,000+', offCampusPercent: '~80%', avgRent: '$1,200+/mo',
      contactRole: 'Director of Off-Campus Housing', contactName: 'Director - ASU Off-Campus Housing',
      contactEmail: 'offcampus@asu.edu', contactDepartment: 'Student Affairs / Housing',
      score: 92, status: 'prospect', partnershipType: 'housing_office',
      notes: 'Largest enrollment in US (145K+); acute housing crisis; only 20% can live on-campus.',
      source: 'playbook'
    },
    {
      id: 'u10', university: 'University of Central Florida', city: 'Orlando', state: 'FL', tier: 2,
      enrollment: '69,800+', offCampusPercent: '~88%', avgRent: '$1,400+/mo',
      contactRole: 'Director of Off-Campus Housing', contactName: 'Director - UCF Off-Campus Life',
      contactEmail: 'offcampus@ucf.edu', contactDepartment: 'Student Affairs / Housing',
      score: 89, status: 'prospect', partnershipType: 'housing_office',
      notes: 'Extreme off-campus dependency (88%); 59K+ undergrads seeking housing.',
      source: 'playbook'
    },
    {
      id: 'u11', university: 'Florida International University', city: 'Miami', state: 'FL', tier: 2,
      enrollment: '57,000+', offCampusPercent: '~80%', avgRent: '$1,800+/mo',
      contactRole: 'Director of Off-Campus Housing', contactName: 'Director - FIU Housing',
      contactEmail: 'housing@fiu.edu', contactDepartment: 'Student Affairs / Housing',
      score: 87, status: 'prospect', partnershipType: 'housing_office',
      notes: '35K+ bed shortage; large international student population; expensive Miami market.',
      source: 'playbook'
    },
    {
      id: 'u12', university: 'Ohio State University', city: 'Columbus', state: 'OH', tier: 2,
      enrollment: '63,600+', offCampusPercent: '~75%', avgRent: '$1,220/bedroom',
      contactRole: 'Director of Off-Campus Housing', contactName: 'Director - OSU Off-Campus & Commuter Student Services',
      contactEmail: 'offcampus@osu.edu', contactDepartment: 'Student Affairs / Housing',
      score: 86, status: 'prospect', partnershipType: 'housing_office',
      notes: 'Third-largest public university; 20-month consecutive rent increases in Columbus.',
      source: 'playbook'
    },
    {
      id: 'u13', university: 'Texas A&M University', city: 'College Station', state: 'TX', tier: 2,
      enrollment: '81,000+', offCampusPercent: '~70%', avgRent: '$1,000+/mo',
      contactRole: 'Director of Off-Campus Housing', contactName: 'Director - TAMU Off-Campus Life',
      contactEmail: 'offcampus@tamu.edu', contactDepartment: 'Student Affairs / Housing',
      score: 84, status: 'prospect', partnershipType: 'housing_office',
      notes: 'Second-largest enrollment in US; strong engagement culture.',
      source: 'playbook'
    },
    {
      id: 'u14', university: 'University of Florida', city: 'Gainesville', state: 'FL', tier: 2,
      enrollment: '56,000+', offCampusPercent: '~75%', avgRent: '$1,100+/mo',
      contactRole: 'Director of Off-Campus Housing', contactName: 'Director - UF Off-Campus Life',
      contactEmail: 'offcampus@ufl.edu', contactDepartment: 'Student Affairs / Housing',
      score: 82, status: 'prospect', partnershipType: 'housing_office',
      notes: 'Large off-campus population; underserved market.',
      source: 'playbook'
    },

    // TIER 3: Prestige & Expansion (Months 6-12)
    {
      id: 'u15', university: 'Stanford University', city: 'Palo Alto', state: 'CA', tier: 3,
      enrollment: '17,400', offCampusPercent: '~50%', avgRent: '$6,066/mo',
      contactRole: 'Director of Off-Campus Housing', contactName: 'Director - Stanford R&DE',
      contactEmail: 'rde@stanford.edu', contactDepartment: 'Student Affairs / Housing',
      score: 91, status: 'prospect', partnershipType: 'housing_office',
      notes: 'Highest median rent in US ($6,066/mo); VC/tech network; massive prestige signal for SweetLease credibility.',
      source: 'playbook'
    },
    {
      id: 'u16', university: 'University of Pennsylvania', city: 'Philadelphia', state: 'PA', tier: 3,
      enrollment: '25,000+', offCampusPercent: '~60%', avgRent: '$1,600+/mo',
      contactRole: 'Director of Off-Campus Housing', contactName: 'Director - Penn Off-Campus Living',
      contactEmail: 'offcampus@upenn.edu', contactDepartment: 'Student Affairs / Housing',
      score: 85, status: 'prospect', partnershipType: 'housing_office',
      notes: 'Ivy League; expensive urban market; grad-heavy.',
      source: 'playbook'
    },
    {
      id: 'u17', university: 'Northeastern University', city: 'Boston', state: 'MA', tier: 3,
      enrollment: '36,000+', offCampusPercent: '~60%', avgRent: '$2,200+/mo',
      contactRole: 'Director of Off-Campus Housing', contactName: 'Director - NEU Off-Campus Engagement',
      contactEmail: 'offcampus@northeastern.edu', contactDepartment: 'Student Affairs / Housing',
      score: 83, status: 'prospect', partnershipType: 'housing_office',
      notes: 'Co-op program creates frequent relocation needs; tech-forward institution.',
      source: 'playbook'
    },
    {
      id: 'u18', university: 'USC', city: 'Los Angeles', state: 'CA', tier: 3,
      enrollment: '49,000+', offCampusPercent: '~65%', avgRent: '$2,500+/mo',
      contactRole: 'Director of Off-Campus Housing', contactName: 'Director - USC Off-Campus Housing',
      contactEmail: 'offcampus@usc.edu', contactDepartment: 'Student Affairs / Housing',
      score: 84, status: 'prospect', partnershipType: 'housing_office',
      notes: 'Major LA market; wealthy demographics; proptech hub ecosystem.',
      source: 'playbook'
    },
    {
      id: 'u19', university: 'University of Washington', city: 'Seattle', state: 'WA', tier: 3,
      enrollment: '47,000+', offCampusPercent: '~70%', avgRent: '$1,800+/mo',
      contactRole: 'Director of Off-Campus Housing', contactName: 'Director - UW Off-Campus Living',
      contactEmail: 'offcampus@uw.edu', contactDepartment: 'Student Affairs / Housing',
      score: 82, status: 'prospect', partnershipType: 'housing_office',
      notes: 'Seattle tech hub; high adoption rates; expensive market.',
      source: 'playbook'
    },
    {
      id: 'u20', university: 'University of Michigan', city: 'Ann Arbor', state: 'MI', tier: 3,
      enrollment: '47,000+', offCampusPercent: '~65%', avgRent: '$1,300+/mo',
      contactRole: 'Director of Off-Campus Housing', contactName: 'Director - UMich Off-Campus Life',
      contactEmail: 'offcampus@umich.edu', contactDepartment: 'Student Affairs / Housing',
      score: 80, status: 'prospect', partnershipType: 'housing_office',
      notes: 'Well-established off-campus coordination office (partnership template already exists at UMich).',
      source: 'playbook'
    },
  ];
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tier = searchParams.get('tier');
    const state = searchParams.get('state');
    const type = searchParams.get('type');

    let contacts = getUniversityContacts();

    if (tier) {
      contacts = contacts.filter(c => c.tier === parseInt(tier));
    }
    if (state) {
      contacts = contacts.filter(c => c.state === state);
    }
    if (type) {
      contacts = contacts.filter(c => c.partnershipType === type);
    }

    return NextResponse.json({
      universities: contacts,
      total: contacts.length,
      source: 'playbook',
    });
  } catch (error: any) {
    console.error('Error fetching universities:', error);
    return NextResponse.json({
      universities: [],
      total: 0,
      source: 'error',
      error: error.message,
    }, { status: 500 });
  }
}
