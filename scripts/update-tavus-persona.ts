/**
 * One-time script to update the Tavus persona with:
 * - STT hotwords for brand/industry terms
 * - Higher participant pause sensitivity
 * - Guardrails prompt
 * - Default qualification objectives
 *
 * Usage: npx tsx scripts/update-tavus-persona.ts
 */

const TAVUS_API_KEY = process.env.TAVUS_API_KEY;
const PERSONA_ID = process.env.TAVUS_PERSONA_ID || 'pae953fafc44';

if (!TAVUS_API_KEY) {
  console.error('ERROR: TAVUS_API_KEY environment variable is required');
  process.exit(1);
}

const guardrailsPrompt = `GUARDRAILS — You MUST follow these rules at all times:

1. COMPETITOR PRICING: Never share competitor pricing, rate comparisons, or direct feature comparisons with any competitor. If asked, say: "I'd rather focus on what SweetLease can do for you specifically. Every situation is different."

2. SAVINGS CLAIMS: Never make unqualified savings promises. Always use hedging language like "on average," "typically," "based on what we've seen," or "depending on your market." Never guarantee a specific dollar amount of savings.

3. CONTRACTS / SLAs / LEGAL: Do not discuss contract terms, SLAs, legal agreements, liability, or compliance details. If asked, say: "That's a great question — Robert will follow up with the relevant documentation so you can review it with your team."

4. INTERNAL INFORMATION: Never share internal financials, investor information, funding details, revenue numbers, or employee count. If asked, say: "I appreciate the curiosity, but I'm not able to share internal details."

5. SCOPE: Stay focused on SweetLease's housing platform and the prospect's needs. Do not discuss unrelated topics at length. Gently redirect back to the conversation.`;

const qualificationObjective = `DEFAULT QUALIFICATION OBJECTIVE — In every conversation, naturally work toward understanding these four things (ask them conversationally, NOT as a checklist):
1. Pain point: What specific housing/relocation challenge are they dealing with today?
2. Scale of need: How many units, employees, students, or residents are involved?
3. Current process: How are they handling this today? What tools or partners do they use?
4. Decision timeline: When would they need to have a solution in place?

Guide the conversation toward these topics but let the prospect lead. If they want to go deep on one area, follow their lead.`;

async function updatePersona() {
  console.log(`Updating Tavus persona ${PERSONA_ID}...`);

  const response = await fetch(`https://tavusapi.com/v2/personas/${PERSONA_ID}`, {
    method: 'PATCH',
    headers: {
      'x-api-key': TAVUS_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      // STT hotwords for accurate speech recognition
      pipeline_mode_config: {
        stt: {
          hotwords: 'SweetLease, Greystar, Lincoln, Calendly, PGY-1, Rentcast, SOC 2, FCRA, Tesla, Delta, Apple, Boeing, Bank of America',
        },
      },
      // Wait longer before responding — prospects pause to think
      participant_pause_sensitivity: 'high',
      // Guardrails + qualification objective appended to system prompt
      system_prompt_addendum: `${guardrailsPrompt}\n\n${qualificationObjective}`,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error(`FAILED (${response.status}):`, err);
    process.exit(1);
  }

  const data = await response.json();
  console.log('SUCCESS — Persona updated:');
  console.log(JSON.stringify(data, null, 2));
}

updatePersona().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
