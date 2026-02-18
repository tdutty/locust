import { NextRequest, NextResponse } from 'next/server';

// SweetLease Legal Playbook positions
const PLAYBOOK = {
  leaseTerm: {
    standard: '12 months',
    acceptable: '6-24 months',
    escalation: 'Over 24 months or under 6 months',
  },
  rentAndDeposit: {
    standard: 'Deposit = 1 month rent',
    acceptable: 'Deposit up to 2 months',
    escalation: 'Deposit over 2 months or no deposit specified',
  },
  earlyTermination: {
    standard: '30 days notice + 1 month penalty',
    acceptable: '30-60 days notice + up to 2 months penalty',
    escalation: 'No early termination clause or 60+ day notice with 3+ months penalty',
  },
  maintenance: {
    standard: 'Landlord responsible for structural/major; tenant for minor',
    acceptable: 'Clear division of responsibilities',
    escalation: 'Tenant responsible for all maintenance or no maintenance clause',
  },
  insurance: {
    standard: 'Renters insurance required ($100k min liability)',
    acceptable: 'Insurance encouraged or required with reasonable minimums',
    escalation: 'No insurance mention',
  },
  pets: {
    standard: 'Case-by-case with reasonable deposit',
    acceptable: 'Pets allowed with deposit up to $500 and monthly fee up to $50',
    escalation: 'Blanket ban on all pets (limits market reach)',
  },
  leadPaint: {
    standard: 'EPA lead paint disclosure fully completed',
    acceptable: 'Disclosure present with all boxes checked',
    escalation: 'Missing disclosure or blank checkboxes',
  },
  corporateRelocation: {
    standard: 'SweetLease Corporate Relocation Addendum included',
    acceptable: 'Employer relocation provisions present',
    escalation: 'No corporate relocation provisions',
  },
  platformTerms: {
    standard: 'SweetLease Platform Terms addendum included',
    acceptable: 'Platform usage terms referenced',
    escalation: 'No platform terms for SweetLease-sourced leases',
  },
};

const STATE_REQUIREMENTS: Record<string, string[]> = {
  SC: [
    'Security deposit cannot exceed 1 month rent (no state cap, but standard practice)',
    'Landlord must return deposit within 30 days',
    'Lead paint disclosure required for pre-1978 buildings',
    'Must provide move-in checklist',
    'Landlord must maintain habitable conditions',
    'Tenant must be given 14 days notice for eviction for non-payment',
  ],
  TX: [
    'No state limit on security deposits',
    'Landlord must return deposit within 30 days',
    'Must disclose known material defects',
    'Lead paint disclosure required for pre-1978 buildings',
    'Must provide tenant copy of lease within 3 days',
    'Cannot lockout tenant without court order',
  ],
  CA: [
    'Security deposit max 1 month (unfurnished) or 2 months (furnished)',
    'Must return deposit within 21 days',
    'Must disclose mold, flood zone, death on property',
    'Rent control may apply (AB 1482)',
    'Lead paint disclosure required for pre-1978 buildings',
    'Must provide 24-hour notice before entry',
  ],
  NC: [
    'Security deposit max 1.5 months for month-to-month, 2 months for longer',
    'Must return deposit within 30 days',
    'Must provide move-in inspection',
    'Lead paint disclosure required for pre-1978 buildings',
    'Landlord responsible for fit and habitable conditions',
    'Must disclose lead paint and known hazards',
  ],
  GA: [
    'No state limit on security deposits',
    'Must return deposit within 30 days',
    'Must provide move-in inspection list',
    'Lead paint disclosure required for pre-1978 buildings',
    'Must maintain in substantial compliance with building codes',
    'Landlord must disclose flooding history',
  ],
};

function classifyClause(
  clauseName: string,
  value: string | null,
  playbookKey: keyof typeof PLAYBOOK
): { classification: 'GREEN' | 'YELLOW' | 'RED'; issue: string | null; recommendation: string | null } {
  const position = PLAYBOOK[playbookKey];
  if (!value || value.trim() === '') {
    return {
      classification: 'RED',
      issue: `Missing ${clauseName} clause`,
      recommendation: `Add ${clauseName} clause per playbook standard: ${position.standard}`,
    };
  }
  // Simplified classification logic - in production this would be more sophisticated
  return {
    classification: 'GREEN',
    issue: null,
    recommendation: null,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    switch (action) {
      case 'review': {
        const { leaseText, state = 'SC' } = params;
        if (!leaseText) {
          return NextResponse.json({ error: 'leaseText is required' }, { status: 400 });
        }

        const text = leaseText.toLowerCase();
        const clauses: Array<{
          clauseName: string;
          classification: 'GREEN' | 'YELLOW' | 'RED';
          playbookPosition: string;
          issue: string | null;
          recommendation: string | null;
          priority: string | null;
        }> = [];

        // Analyze key clauses
        const checks = [
          {
            name: 'Lease Term',
            key: 'leaseTerm' as keyof typeof PLAYBOOK,
            present: text.includes('term') || text.includes('month'),
          },
          {
            name: 'Security Deposit',
            key: 'rentAndDeposit' as keyof typeof PLAYBOOK,
            present: text.includes('deposit') || text.includes('security'),
          },
          {
            name: 'Early Termination',
            key: 'earlyTermination' as keyof typeof PLAYBOOK,
            present: text.includes('early termination') || text.includes('terminate'),
          },
          {
            name: 'Maintenance',
            key: 'maintenance' as keyof typeof PLAYBOOK,
            present: text.includes('maintenance') || text.includes('repair'),
          },
          {
            name: 'Insurance',
            key: 'insurance' as keyof typeof PLAYBOOK,
            present: text.includes('insurance') || text.includes('liability'),
          },
          {
            name: 'Pet Policy',
            key: 'pets' as keyof typeof PLAYBOOK,
            present: text.includes('pet') || text.includes('animal'),
          },
          {
            name: 'Lead Paint Disclosure',
            key: 'leadPaint' as keyof typeof PLAYBOOK,
            present: text.includes('lead') && text.includes('paint'),
          },
          {
            name: 'Corporate Relocation Addendum',
            key: 'corporateRelocation' as keyof typeof PLAYBOOK,
            present: text.includes('corporate relocation') || text.includes('employer relocation'),
          },
          {
            name: 'Platform Terms',
            key: 'platformTerms' as keyof typeof PLAYBOOK,
            present: text.includes('sweetlease') || text.includes('platform'),
          },
        ];

        const missingClauses: string[] = [];

        for (const check of checks) {
          const position = PLAYBOOK[check.key];
          if (!check.present) {
            clauses.push({
              clauseName: check.name,
              classification: 'RED',
              playbookPosition: position.standard,
              issue: `${check.name} clause not found in lease`,
              recommendation: `Add ${check.name} per playbook: ${position.standard}`,
              priority: 'must-have',
            });
            missingClauses.push(check.name);
          } else {
            clauses.push({
              clauseName: check.name,
              classification: 'GREEN',
              playbookPosition: position.standard,
              issue: null,
              recommendation: null,
              priority: null,
            });
          }
        }

        const greenCount = clauses.filter((c) => c.classification === 'GREEN').length;
        const yellowCount = clauses.filter((c) => c.classification === 'YELLOW').length;
        const redCount = clauses.filter((c) => c.classification === 'RED').length;

        const overallRating = redCount > 0 ? 'RED' : yellowCount > 2 ? 'YELLOW' : 'GREEN';

        const stateReqs = STATE_REQUIREMENTS[state.toUpperCase()] || [];

        return NextResponse.json({
          reviewDate: new Date().toISOString(),
          state,
          clauses,
          greenCount,
          yellowCount,
          redCount,
          overallRating,
          missingClauses,
          stateRequirements: stateReqs,
          recommendations: missingClauses.map(
            (c) => `Add missing ${c} clause per SweetLease playbook`
          ),
        });
      }

      case 'compliance': {
        const { state = 'SC' } = params;
        const reqs = STATE_REQUIREMENTS[state.toUpperCase()] || [];
        return NextResponse.json({
          state: state.toUpperCase(),
          requirements: reqs,
          count: reqs.length,
        });
      }

      case 'playbook': {
        const { clauseType } = params;
        if (clauseType && PLAYBOOK[clauseType as keyof typeof PLAYBOOK]) {
          return NextResponse.json({
            clauseType,
            position: PLAYBOOK[clauseType as keyof typeof PLAYBOOK],
          });
        }
        return NextResponse.json({ playbook: PLAYBOOK });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}. Use 'review', 'compliance', or 'playbook'.` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Legal review error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'Legal Review API active',
    actions: ['review', 'compliance', 'playbook'],
    supportedStates: Object.keys(STATE_REQUIREMENTS),
  });
}
