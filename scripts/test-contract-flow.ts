/**
 * Test script for contract & security document handling
 * Run: npx tsx scripts/test-contract-flow.ts
 */

import { classifyEmail } from '../src/lib/inbox-fetcher';
import { buildContractDocsHtml, getSuggestedAction, generateAdminContractNotification } from '../src/lib/reply-generator';

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

// ─── 1. Keyword Classification Tests ──────────────────────────────────────

console.log('\n=== 1. classifyEmail() — contract_request detection ===\n');

const contractTestCases = [
  { subject: 'Re: SweetLease Partnership', body: 'We need an NDA before proceeding', expected: 'contract_request' },
  { subject: 'Next steps', body: 'Can you send over a contract?', expected: 'contract_request' },
  { subject: 'Re: Housing', body: 'Our legal team needs to review this first', expected: 'contract_request' },
  { subject: 'Procurement', body: 'Our procurement process requires a security questionnaire', expected: 'contract_request' },
  { subject: 'Re: SweetLease', body: 'Do you have an MSA we can review?', expected: 'contract_request' },
  { subject: 'Re: Partnership', body: 'Please send us your terms of service', expected: 'contract_request' },
  { subject: 'Documents needed', body: 'We need a data processing agreement', expected: 'contract_request' },
  { subject: 'SOC 2', body: 'Do you have SOC 2 compliance documentation?', expected: 'contract_request' },
  { subject: 'Vendor assessment', body: 'Our vendor assessment team needs some docs', expected: 'contract_request' },
  { subject: 'Listing agreement', body: 'Can you send the listing agreement?', expected: 'contract_request' },
  { subject: 'Non-disclosure', body: 'We require a non-disclosure agreement', expected: 'contract_request' },
  { subject: 'Legal review', body: 'This needs legal review before we can move forward', expected: 'contract_request' },
  { subject: 'Procurement', body: 'Procurement requires additional documentation', expected: 'contract_request' },
  { subject: 'Master Service Agreement', body: 'Please provide your master service agreement', expected: 'contract_request' },
  { subject: 'Send us your terms', body: 'Before we can proceed, send us your terms', expected: 'contract_request' },
];

for (const tc of contractTestCases) {
  const { classification } = classifyEmail(tc.subject, tc.body);
  assert(
    `"${tc.body.substring(0, 50)}" → ${tc.expected}`,
    classification === tc.expected,
    `got "${classification}"`
  );
}

// ─── 2. Contract request takes priority over interested ────────────────

console.log('\n=== 2. Priority: contract_request beats interested ===\n');

const priorityCases = [
  { subject: 'Interested', body: 'Interested, please send over a contract', expected: 'contract_request' },
  { subject: 'Sounds good', body: 'Sounds good, but we need an NDA first', expected: 'contract_request' },
  { subject: 'Meeting + NDA', body: "Let's schedule a meeting, but our legal team requires an NDA", expected: 'contract_request' },
];

for (const tc of priorityCases) {
  const { classification } = classifyEmail(tc.subject, tc.body);
  assert(
    `"${tc.body.substring(0, 55)}" → ${tc.expected} (not interested)`,
    classification === tc.expected,
    `got "${classification}"`
  );
}

// ─── 3. Non-contract emails still classify correctly ──────────────────

console.log('\n=== 3. Non-contract emails unaffected ===\n');

const otherCases = [
  { subject: 'Tell me more', body: 'This sounds interesting, tell me more', expected: 'interested' },
  { subject: 'Not now', body: 'Maybe later, not right now', expected: 'objection' },
  { subject: 'Remove me', body: 'Please unsubscribe me from your list', expected: 'not_interested' },
  { subject: 'Question', body: 'How does this work exactly?', expected: 'question' },
  { subject: 'Talk to Sarah', body: 'You should reach out to Sarah in HR', expected: 'referral' },
  { subject: 'Delivery failure', body: 'Message undeliverable', expected: 'system' },
];

for (const tc of otherCases) {
  const { classification } = classifyEmail(tc.subject, tc.body);
  assert(
    `"${tc.subject}" → ${tc.expected}`,
    classification === tc.expected,
    `got "${classification}"`
  );
}

// ─── 4. Contract priority is always 'high' ────────────────────────────

console.log('\n=== 4. Contract requests are always high priority ===\n');

const { priority } = classifyEmail('NDA Request', 'We need an NDA before moving forward');
assert('contract_request priority is high', priority === 'high', `got "${priority}"`);

// ─── 4b. Document received detection ─────────────────────────────────

console.log('\n=== 4b. document_received detection (attachments + signing keywords) ===\n');

const docReceivedCases = [
  { subject: 'Signed NDA', body: 'Here is the signed NDA', attachments: ['SweetLease-NDA-signed.pdf'], expected: 'document_received' },
  { subject: 'Re: SweetLease', body: 'Attached is the executed contract', attachments: ['contract.pdf'], expected: 'document_received' },
  { subject: 'Documents', body: 'Returning the completed NDA and service agreement', attachments: ['nda.pdf', 'service.docx'], expected: 'document_received' },
  { subject: 'Fully executed', body: 'Please find the fully executed agreement attached', attachments: ['agreement.pdf'], expected: 'document_received' },
  { subject: 'Countersigned', body: 'Here are the countersigned docs', attachments: ['docs.pdf'], expected: 'document_received' },
];

for (const tc of docReceivedCases) {
  const { classification } = classifyEmail(tc.subject, tc.body, { hasAttachments: true, attachmentNames: tc.attachments });
  assert(
    `"${tc.body.substring(0, 50)}" + [${tc.attachments[0]}] → ${tc.expected}`,
    classification === tc.expected,
    `got "${classification}"`
  );
}

// Without attachments, signing language alone should NOT trigger document_received
const noAttach = classifyEmail('Signed NDA', 'Here is the signed NDA', { hasAttachments: false, attachmentNames: [] });
assert('Signing keywords WITHOUT attachments → NOT document_received', noAttach.classification !== 'document_received', `got "${noAttach.classification}"`);

// With attachments but no signing language → should NOT be document_received
const noKeywords = classifyEmail('Quick question', 'Can you explain the pricing?', { hasAttachments: true, attachmentNames: ['screenshot.pdf'] });
assert('Attachments WITHOUT signing keywords → NOT document_received', noKeywords.classification !== 'document_received', `got "${noKeywords.classification}"`);

// ─── 4c. Admin notification generator ────────────────────────────────

console.log('\n=== 4c. generateAdminContractNotification() ===\n');

const adminNotif = generateAdminContractNotification({
  contactName: 'Jane Smith',
  contactEmail: 'jane@company.com',
  contactType: 'employer',
  orgName: 'Acme Corp',
  dealId: 42,
  dealStage: 'contract_sent',
  emailSubject: 'Re: SweetLease NDA',
  attachmentNames: ['nda-signed.pdf'],
});
assert('admin subject contains [Contract Received]', adminNotif.subject.includes('[Contract Received]'));
assert('admin subject contains contact name', adminNotif.subject.includes('Jane Smith'));
assert('admin body contains deal ID', adminNotif.body.includes('#42'));
assert('admin body contains action required', adminNotif.body.includes('Action Required'));
assert('admin htmlBody contains styled notification', adminNotif.htmlBody.includes('Signed Documents Received'));
assert('admin htmlBody contains attachment name', adminNotif.htmlBody.includes('nda-signed.pdf'));

// ─── 5. buildContractDocsHtml renders correctly ────────────────────────

console.log('\n=== 5. buildContractDocsHtml() output ===\n');

const landlordHtml = buildContractDocsHtml('landlord', 'all');
assert('landlord all: contains NDA link', landlordHtml.includes('sweetlease-nda.pdf'));
assert('landlord all: contains security link', landlordHtml.includes('sweetlease-security-overview.pdf'));
assert('landlord all: contains listing agreement', landlordHtml.includes('sweetlease-landlord-listing-agreement.pdf'));
assert('landlord all: has green header', landlordHtml.includes('#16a34a'));
assert('landlord all: has "Requested Documents" header', landlordHtml.includes('Requested Documents'));

const ndaOnlyHtml = buildContractDocsHtml('employer', 'nda');
assert('employer nda: contains NDA link', ndaOnlyHtml.includes('sweetlease-nda.pdf'));
assert('employer nda: does NOT contain service agreement', !ndaOnlyHtml.includes('sweetlease-employer-service-agreement.pdf'));

const securityHtml = buildContractDocsHtml('benefits-platform', 'security');
assert('benefits security: contains security overview', securityHtml.includes('sweetlease-security-overview.pdf'));
assert('benefits security: contains DPA', securityHtml.includes('sweetlease-data-processing-agreement.pdf'));
assert('benefits security: does NOT contain NDA', !securityHtml.includes('sweetlease-nda.pdf'));

const uniHtml = buildContractDocsHtml('university', 'contract');
assert('university contract: contains institutional agreement', uniHtml.includes('sweetlease-university-institutional-agreement.pdf'));
assert('university contract: contains NDA (bundled with contract)', uniHtml.includes('sweetlease-nda.pdf'));

// ─── 6. getSuggestedAction includes contract_request ────────────────

console.log('\n=== 6. getSuggestedAction() ===\n');

const action = getSuggestedAction('contract_request');
assert('contract_request action mentions "contract/NDA"', action.includes('contract/NDA'));
assert('contract_request action mentions "2 hours"', action.includes('2 hours'));

const docAction = getSuggestedAction('document_received');
assert('document_received action mentions "countersign"', docAction.includes('countersign'));

// ─── 7. Placeholder PDFs exist ────────────────────────────────────────

console.log('\n=== 7. Placeholder PDF files ===\n');

import { existsSync } from 'fs';
import { join } from 'path';

const contractDir = join(__dirname, '..', 'public', 'docs', 'contracts');
const expectedFiles = [
  'sweetlease-nda.pdf',
  'sweetlease-security-overview.pdf',
  'sweetlease-landlord-listing-agreement.pdf',
  'sweetlease-employer-service-agreement.pdf',
  'sweetlease-university-institutional-agreement.pdf',
  'sweetlease-data-processing-agreement.pdf',
];

for (const file of expectedFiles) {
  assert(`${file} exists`, existsSync(join(contractDir, file)));
}

// ─── Summary ──────────────────────────────────────────────────────────

console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
console.log('='.repeat(50));

if (failed > 0) {
  process.exit(1);
}
