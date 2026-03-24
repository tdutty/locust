/**
 * Adds SweetLease knowledge base content directly to the Retell LLM prompt.
 * This is more reliable than the KB feature and keeps all context in the prompt.
 *
 * Usage: npx tsx scripts/add-kb-to-llm.ts
 */

import Retell from 'retell-sdk';

const RETELL_API_KEY = process.env.RETELL_API_KEY;
const LLM_ID = 'llm_457b5edac0dbca2cf7fa64587432';

if (!RETELL_API_KEY) {
  console.error('ERROR: RETELL_API_KEY required');
  process.exit(1);
}

const client = new Retell({ apiKey: RETELL_API_KEY });

const KNOWLEDGE_BASE = `

## KNOWLEDGE BASE — SweetLease Product Information

### Company Overview
SweetLease is a corporate housing platform based in Dallas, Texas, founded by Robert Gilbert. It connects landlords with pre-screened, qualified tenants sourced from companies, universities, and medical residency programs. Tenants get 15-25% below market rates through group negotiation. Landlords pay a success fee only when a tenant is placed. The platform is free for employers, universities, and residency programs.

### How It Works
1. Landlords list properties on SweetLease (free to list)
2. SweetLease sources tenants from employer relocation programs, university partnerships, and residency programs
3. Every tenant goes through a 4-step verification: identity, background check, credit score, income verification
4. Tenants get below-market rates through group negotiation (15-25% savings)
5. Landlords pay a success fee only when a tenant is placed
6. The platform handles all screening, matching, and placement coordination

### For Landlords
- Every vacant unit costs roughly $60/day or $1,800-3,600/month in lost revenue
- Average time-to-fill: 45+ days traditionally vs. 7-14 days with SweetLease
- Pre-screened, employer-backed tenants with corporate guarantees — zero eviction risk
- Zero listing fees, zero advertising spend, zero commission
- 3x more qualified applications vs. traditional listings
- Real-time portfolio dashboard: revenue per unit, days on market, occupancy rates
- Success fee model only — no upfront costs, no contracts
- ROI: 30 units reducing vacancy from 45 to 14 days saves ~$54,000/year

### For Employers
- 68% of employees say housing stress delays productivity after relocation
- Average employee spends 6 weeks finding housing when relocating
- Companies lose $12,000 per failed relocation
- SweetLease is completely FREE for employers — paid by landlord partnerships
- Employees save 15-25% vs. market rate ($200+/month average)
- Placement in 7 days average vs. 6 weeks traditionally
- HR dashboard tracks relocations from offer letter to move-in day
- ROI: 30 relocations/year saves ~$72,000 in employee housing costs

### For Universities
- Off-campus rents have increased 12% year-over-year
- Completely FREE for the university
- Students save $150/month average (15-25% below market)
- Branded portal with university name and branding
- Every listing verified: background-checked landlords, inspected properties
- Especially valuable for international students who cannot visit before arrival
- Housing office dashboard: placement rates, savings, satisfaction scores
- 90%+ student satisfaction reported by partner universities

### For Medical Residency Programs
- PGY-1 residents making $60-65K spend 40-50% of gross income on rent
- Completely FREE for programs AND residents
- Average savings of $267/month ($3,200/year) per resident
- Move-in dates coordinated with July start dates
- All housing is hospital-adjacent and verified for safety
- Match Day is in March, residents need housing by late June
- Program dashboard tracks entire incoming class placement
- "We provide housing support" is a real recruitment differentiator

### For Benefits Platforms
- 35% of employees say housing costs are their #1 financial stressor
- No major benefits platform currently addresses housing — first-mover advantage
- White-label or co-branded housing marketplace
- API, embedded, or white-label integration options
- SOC 2 compliant infrastructure, enterprise-grade security
- Full audit trail for compliance teams
- Employees save $100-300/month on the #1 household expense

### Common Objections & Answers
- "How do you make money?" → Success fee from landlords when we place a tenant. Landlords pay because we bring pre-screened, guaranteed tenants faster than any other channel.
- "What areas do you cover?" → Expanding nationwide. Strongest in major metros. Can onboard landlords in new markets within 2-4 weeks.
- "How is this different from Zillow?" → Zillow is an open listing platform with no verification. SweetLease is a curated marketplace with verified properties, pre-screened tenants, and group-negotiated rates. Think of us as the Costco of housing.
- "We already use a relocation company." → SweetLease complements relo providers. They handle logistics (moving, visas), we handle housing specifically with verified options at better rates.
- "How long does onboarding take?" → Typically 2-3 weeks to set up branded portal and onboard local landlords.
- "Is there a minimum commitment?" → No minimum commitment, no contracts. Start with a pilot and scale.
- "What about security?" → SOC 2 compliant, encrypted data, full audit trail.
- "Is the 15-25% savings realistic?" → Based on actual placements. Savings come from group negotiation leverage, similar to Costco bulk rates.

### Competitive Positioning
- vs. Zillow/Apartments.com: No verification, market-rate pricing, scam-heavy. SweetLease: verified, below-market, corporate-backed.
- vs. Relocation companies (BGRS, SIRVA): Expensive ($15-30K per relo), housing is self-service. SweetLease: housing-focused, free for employers.
- vs. Corporate housing (Blueground): Short-term, premium pricing. SweetLease: long-term leases, group rates.
- vs. University portals (Off Campus Partners): Basic listings, no savings. SweetLease: verified, group rates, branded portal, analytics.`;

async function run() {
  console.log('Fetching current LLM prompt...');
  const llm = await client.llm.retrieve(LLM_ID);
  const currentPrompt = llm.general_prompt || '';
  console.log(`  Current prompt: ${currentPrompt.length} chars`);

  if (currentPrompt.includes('## KNOWLEDGE BASE')) {
    console.log('  Knowledge base already embedded. Skipping.');
    return;
  }

  const updatedPrompt = currentPrompt + KNOWLEDGE_BASE;
  console.log(`  Updated prompt: ${updatedPrompt.length} chars`);

  console.log('Updating LLM...');
  const updated = await client.llm.update(LLM_ID, {
    general_prompt: updatedPrompt,
  });

  console.log(`SUCCESS — LLM prompt updated to ${(updated.general_prompt || '').length} chars`);
  console.log('The agent now has full SweetLease product knowledge embedded in its prompt.');
}

run().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
