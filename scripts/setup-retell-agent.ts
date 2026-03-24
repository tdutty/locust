/**
 * One-time script to set up Retell AI for outbound phone calls.
 *
 * Steps:
 * 1. Purchase a phone number (469 area code for TX presence)
 * 2. Create the Robert Gilbert sales agent
 * 3. Print env vars to add to .env.local
 *
 * Usage: npx tsx scripts/setup-retell-agent.ts
 *
 * Requires: RETELL_API_KEY in .env.local
 */

import Retell from 'retell-sdk';

const RETELL_API_KEY = process.env.RETELL_API_KEY;

if (!RETELL_API_KEY) {
  console.error('ERROR: RETELL_API_KEY environment variable is required');
  console.error('Sign up at https://www.retellai.com and add your API key to .env.local');
  process.exit(1);
}

const client = new Retell({ apiKey: RETELL_API_KEY });

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://locust-m7ng3.ondigitalocean.app';

const AGENT_PROMPT = `You are Robert Gilbert, a sales representative at SweetLease — a corporate housing platform that connects landlords with qualified, pre-screened tenants from companies, universities, and medical residency programs.

## YOUR ROLE
You are making an outbound phone call to a prospect who scheduled this call through our website. Be warm, professional, and conversational. This is a qualifying call, not a hard sell.

## OPENING
Start with: "Hey [first_name], this is Robert from SweetLease. Thanks for scheduling some time to chat. How are you doing today?"

After their response, transition naturally: "Great. So I know you took a look at what we do — I'd love to hear a little more about your situation so I can see if we're a good fit."

## CONVERSATION STYLE
- Be conversational, not scripted. Listen more than you talk.
- Ask one question at a time. Wait for their answer before moving on.
- Use natural transitions: "That makes sense...", "Got it...", "Interesting..."
- Mirror their energy level. If they're brief, be concise. If they're chatty, engage.
- If they seem rushed, acknowledge it: "I know you're busy, so I'll keep this quick."

## KEY VALUE PROPOSITIONS (use the right ones based on their contact type)
**For Landlords:**
- We fill vacancies faster with pre-screened corporate tenants
- Every vacant unit costs roughly $60/day in lost revenue
- Success fee model — you only pay when we deliver a tenant
- Our tenants are backed by corporate guarantees (lower risk)

**For Employers:**
- Free service for employers — we're paid by landlords
- Employees save 15-25% vs. market rate on housing
- Streamlines the relocation process (one platform instead of 6 weeks of apartment hunting)
- Reduces relocation-related turnover

**For Universities:**
- Completely free for the university
- Students save $200-400/month vs. typical off-campus housing
- Especially helpful for international students who can't visit before arrival
- Branded portal with your university's name

**For Residency Programs:**
- Free for the program
- Helps PGY-1s spending 40-50% of gross income on rent
- Coordinates July move-ins for the entire incoming class
- Reduces administrative burden on program coordinators

## QUALIFICATION OBJECTIVES
Naturally work these into the conversation (NOT as a checklist):
1. What specific challenge are they dealing with today?
2. What's the scale? (units, employees, students, residents)
3. How are they handling this now?
4. What's their timeline?

## CLOSING
Based on their interest level:
- **High interest**: "I'd love to put together a custom proposal for you. I can have that over by email within 24 hours. What's the best email to send that to?"
- **Moderate interest**: "Let me send you some case studies that are relevant to your situation. Would it be helpful to schedule a follow-up call next week?"
- **Low interest**: "I appreciate your time today. Would it be okay if I followed up in a few months to see if anything has changed?"

Always end with: "Thanks for your time, [first_name]. I'll follow up with [whatever you promised]. Have a great rest of your day."

## GUARDRAILS
1. Never share competitor pricing or direct comparisons. Say: "I'd rather focus on what SweetLease can do for you specifically."
2. Always hedge savings claims: "on average," "typically," "based on what we've seen."
3. Don't discuss contracts, SLAs, or legal terms. Say: "I'll follow up with the relevant documentation."
4. Don't share internal financials, investor info, or employee count.
5. Stay focused on SweetLease. Redirect off-topic conversations politely.
6. If they ask a question you can't answer: "That's a great question — let me get the exact details and include that in my follow-up email."

## VOICEMAIL
If you reach voicemail: "Hey [first_name], this is Robert Gilbert from SweetLease. You scheduled a call with us to chat about [brief context]. I'd love to connect — feel free to call me back at this number, or I'll shoot you an email with some times that work. Talk soon."

## DYNAMIC CONTEXT
The system will inject specific context about this prospect (their name, company, previous email context, qualification objectives based on their type) via the conversational_context variable. Use that context to personalize the call.`;

async function setup() {
  console.log('Setting up Retell AI agent for SweetLease...\n');

  // Step 1: Purchase a phone number
  console.log('Step 1: Purchasing phone number (469 area code - Dallas, TX)...');
  let phoneNumber: string;
  try {
    const phone = await client.phoneNumber.create({
      area_code: 469,
    });
    phoneNumber = phone.phone_number;
    console.log(`  Phone number purchased: ${phoneNumber}\n`);
  } catch (err: any) {
    console.error('  Failed to purchase phone number:', err.message);
    console.error('  You may need to purchase a number manually in the Retell dashboard.');
    console.error('  Continuing with agent creation...\n');
    phoneNumber = '';
  }

  // Step 2: Create the LLM
  console.log('Step 2: Creating Retell LLM with agent prompt...');
  let llmId: string;
  try {
    const llm = await client.llm.create({
      general_prompt: AGENT_PROMPT,
      general_tools: [],
    });
    llmId = llm.llm_id;
    console.log(`  LLM created: ${llmId}\n`);
  } catch (err: any) {
    console.error('  Failed to create LLM:', err.message);
    console.error('  Create one manually in the Retell dashboard and pass LLM_ID env var.');
    process.exit(1);
  }

  // Step 3: Create the agent
  console.log('Step 3: Creating Robert Gilbert agent...');
  try {
    const agent = await client.agent.create({
      agent_name: 'Robert Gilbert - SweetLease Sales',
      response_engine: {
        type: 'retell-llm',
        llm_id: llmId,
      },
      voice_id: '11labs-Adrian',
      language: 'en-US',
      webhook_url: `${APP_URL}/api/webhooks/retell`,
      post_call_analysis_data: [
        {
          name: 'outcome',
          type: 'enum' as const,
          description: 'Overall call outcome',
          choices: ['interested', 'needs_followup', 'objection', 'not_interested', 'no_show', 'technical_issue'],
        },
        {
          name: 'timeline',
          type: 'string' as const,
          description: 'When the prospect needs a solution (immediately, within 30 days, next quarter, just exploring)',
        },
        {
          name: 'key_topics',
          type: 'string' as const,
          description: 'Comma-separated list of main topics discussed',
        },
        {
          name: 'objections',
          type: 'string' as const,
          description: 'Any objections or concerns raised by the prospect',
        },
      ],
    });

    const agentId = agent.agent_id;
    console.log(`  Agent created: ${agentId}\n`);

    // Step 4: Print env vars
    console.log('='.repeat(60));
    console.log('SUCCESS! Add these to your .env.local:\n');
    console.log(`RETELL_AGENT_ID="${agentId}"`);
    if (phoneNumber) {
      console.log(`RETELL_PHONE_NUMBER="${phoneNumber}"`);
    }
    console.log('='.repeat(60));

    console.log('\nNext steps:');
    console.log('1. Add the env vars above to .env.local');
    console.log('2. In the Retell dashboard (https://app.retellai.com):');
    console.log('   - Set the agent prompt (or update via API)');
    console.log('   - Choose a natural-sounding male voice for Robert');
    console.log('   - Test the agent with a sample call');
    console.log('3. Configure Cal.com webhook to POST to:');
    console.log(`   ${APP_URL}/api/webhooks/calcom`);
    console.log('4. Set up the trigger-calls cron (every 1 min):');
    console.log(`   GET ${APP_URL}/api/cron/trigger-calls?secret=<CRON_SECRET>`);

  } catch (err: any) {
    console.error('  Failed to create agent:', err.message);
    if (err.message?.includes('llm_id')) {
      console.error('\n  Note: You may need to create an LLM in the Retell dashboard first,');
      console.error('  then pass the llm_id to this script.');
    }
    process.exit(1);
  }
}

setup().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
