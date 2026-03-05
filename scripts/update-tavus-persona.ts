/**
 * One-time script to update the Tavus persona with:
 * - STT hotwords for brand/industry terms
 * - Higher participant pause sensitivity
 * - Guardrails appended to system prompt
 * - Default qualification objectives appended to system prompt
 *
 * Uses JSON Patch (RFC 6902) format required by Tavus API.
 *
 * Usage: npx tsx scripts/update-tavus-persona.ts
 */

const TAVUS_API_KEY = process.env.TAVUS_API_KEY;
const PERSONA_ID = process.env.TAVUS_PERSONA_ID || 'pae953fafc44';

if (!TAVUS_API_KEY) {
  console.error('ERROR: TAVUS_API_KEY environment variable is required');
  process.exit(1);
}

const guardrailsPrompt = `

## GUARDRAILS — You MUST follow these rules at all times

1. COMPETITOR PRICING: Never share competitor pricing, rate comparisons, or direct feature comparisons with any competitor. If asked, say: "I'd rather focus on what SweetLease can do for you specifically. Every situation is different."

2. SAVINGS CLAIMS: Never make unqualified savings promises. Always use hedging language like "on average," "typically," "based on what we've seen," or "depending on your market." Never guarantee a specific dollar amount of savings.

3. CONTRACTS / SLAs / LEGAL: Do not discuss contract terms, SLAs, legal agreements, liability, or compliance details. If asked, say: "That's a great question — I will follow up with the relevant documentation so you can review it with your team."

4. INTERNAL INFORMATION: Never share internal financials, investor information, funding details, revenue numbers, or employee count. If asked, say: "I appreciate the curiosity, but I am not able to share internal details."

5. SCOPE: Stay focused on SweetLease's housing platform and the prospect's needs. Do not discuss unrelated topics at length. Gently redirect back to the conversation.`;

const qualificationObjective = `

## DEFAULT QUALIFICATION OBJECTIVE

In every conversation, naturally work toward understanding these four things (ask them conversationally, NOT as a checklist):
1. Pain point: What specific housing or relocation challenge are they dealing with today?
2. Scale of need: How many units, employees, students, or residents are involved?
3. Current process: How are they handling this today? What tools or partners do they use?
4. Decision timeline: When would they need to have a solution in place?

Guide the conversation toward these topics but let the prospect lead. If they want to go deep on one area, follow their lead.`;

async function updatePersona() {
  console.log(`Fetching current persona ${PERSONA_ID}...`);

  // First, GET the current persona to read existing system_prompt
  const getResponse = await fetch(`https://tavusapi.com/v2/personas/${PERSONA_ID}`, {
    headers: { 'x-api-key': TAVUS_API_KEY! },
  });

  if (!getResponse.ok) {
    const err = await getResponse.text();
    console.error(`Failed to fetch persona (${getResponse.status}):`, err);
    process.exit(1);
  }

  const persona = await getResponse.json();
  const currentPrompt = persona.system_prompt || '';

  // Check if guardrails are already appended
  const alreadyHasGuardrails = currentPrompt.includes('## GUARDRAILS');
  const alreadyHasQualification = currentPrompt.includes('## DEFAULT QUALIFICATION OBJECTIVE');

  let promptAddendum = '';
  if (!alreadyHasGuardrails) promptAddendum += guardrailsPrompt;
  if (!alreadyHasQualification) promptAddendum += qualificationObjective;

  const updatedPrompt = currentPrompt + promptAddendum;

  // Build JSON Patch operations
  const operations: { op: string; path: string; value: string }[] = [
    {
      op: 'replace',
      path: '/layers/stt/hotwords',
      value: 'SweetLease, Greystar, Lincoln, Calendly, PGY-1, Rentcast, SOC 2, FCRA, Tesla, Delta, Apple, Boeing, Bank of America',
    },
    {
      op: 'replace',
      path: '/layers/stt/participant_pause_sensitivity',
      value: 'high',
    },
  ];

  // Only update system_prompt if we have new content to add
  if (promptAddendum) {
    operations.push({
      op: 'replace',
      path: '/system_prompt',
      value: updatedPrompt,
    });
  }

  console.log(`Applying ${operations.length} patch operations...`);
  operations.forEach((op, i) => {
    const preview = op.value.length > 80 ? op.value.substring(0, 80) + '...' : op.value;
    console.log(`  ${i + 1}. ${op.op} ${op.path} → "${preview}"`);
  });

  const patchResponse = await fetch(`https://tavusapi.com/v2/personas/${PERSONA_ID}`, {
    method: 'PATCH',
    headers: {
      'x-api-key': TAVUS_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(operations),
  });

  if (patchResponse.status === 304) {
    console.log('\nPersona already up to date (304 Not Modified). No changes needed.');
    return;
  }

  if (!patchResponse.ok) {
    const err = await patchResponse.text();
    console.error(`FAILED (${patchResponse.status}):`, err);
    process.exit(1);
  }

  const data = await patchResponse.json();

  // Verify changes
  console.log('\nSUCCESS — Persona updated.');
  console.log(`  Hotwords: ${data.layers?.stt?.hotwords || '(check response)'}`);
  console.log(`  Pause sensitivity: ${data.layers?.stt?.participant_pause_sensitivity || '(check response)'}`);
  console.log(`  System prompt length: ${(data.system_prompt || '').length} chars`);
  console.log(`  Has guardrails: ${(data.system_prompt || '').includes('## GUARDRAILS')}`);
  console.log(`  Has qualification objective: ${(data.system_prompt || '').includes('## DEFAULT QUALIFICATION OBJECTIVE')}`);
}

updatePersona().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
