/**
 * End-to-end test: Simulate a contract request from terrellgilb5@gmail.com
 * and schedule the styled contract reply for immediate delivery.
 *
 * Run: npx tsx scripts/test-send-contract-reply.ts
 * Then trigger send-emails cron to actually deliver it.
 */

import { config } from 'dotenv';
config({ path: '.env.local', override: true });

const TEST_EMAIL = 'terrellgilb5@gmail.com';
const TEST_NAME = 'Terrell Gilbert';

async function main() {
  // Dynamic imports so env is loaded before any module reads process.env
  const { query } = await import('../src/lib/db');
  const { classifyEmail } = await import('../src/lib/inbox-fetcher');
  const { classifyContractRequest, generateContractReply } = await import('../src/lib/reply-generator');
  type OriginalEmail = import('../src/lib/reply-generator').OriginalEmail;

  console.log('=== Contract Reply E2E Test ===\n');

  // 1. Ensure contact exists
  console.log('1. Ensuring contact exists...');
  let contactResult = await query(
    `SELECT * FROM contacts WHERE LOWER(email) = LOWER($1) LIMIT 1`,
    [TEST_EMAIL]
  );

  let contactId: number;
  let contactType: string;

  if (contactResult.rows.length > 0) {
    contactId = contactResult.rows[0].id;
    contactType = contactResult.rows[0].contact_type || 'employer';
    console.log(`   Found existing contact #${contactId} (${contactResult.rows[0].name}, type: ${contactType})`);
  } else {
    const newContact = await query(
      `INSERT INTO contacts (first_name, last_name, name, email, contact_type, status)
       VALUES ($1, $2, $3, $4, $5, 'new')
       RETURNING id`,
      ['Terrell', 'Gilbert', TEST_NAME, TEST_EMAIL, 'employer']
    );
    contactId = newContact.rows[0].id;
    contactType = 'employer';
    console.log(`   Created test contact #${contactId}`);
  }

  // 2. Simulate the incoming email
  const mockEmail = {
    subject: 'Re: SweetLease Partnership',
    body: 'Hi Robert,\n\nThis looks promising. Before we can move forward, we need an NDA and a service agreement for our legal team to review.\n\nCan you send those over?\n\nThanks,\nTerrell',
  };

  console.log('\n2. Classifying email...');
  const { classification, priority } = classifyEmail(mockEmail.subject, mockEmail.body);
  console.log(`   Classification: ${classification} (priority: ${priority})`);

  if (classification !== 'contract_request') {
    console.error('   ERROR: Expected contract_request classification!');
    process.exit(1);
  }

  // 3. Sub-classify the request type
  console.log('\n3. Sub-classifying contract request type...');
  const requestType = await classifyContractRequest(mockEmail.body);
  console.log(`   Request type: ${requestType}`);

  // 4. Generate the contract reply
  console.log('\n4. Generating contract reply...');
  const originalEmail: OriginalEmail = {
    from: TEST_NAME,
    fromEmail: TEST_EMAIL,
    subject: mockEmail.subject,
    body: mockEmail.body,
    classification: 'contract_request',
    contactType,
  };

  const reply = await generateContractReply(originalEmail, requestType);
  if (!reply) {
    console.error('   ERROR: Failed to generate reply!');
    process.exit(1);
  }

  console.log(`   Subject: ${reply.subject}`);
  console.log(`   Source: ${reply.source}`);
  console.log(`   Docs included: ${reply.docsIncluded.join(', ')}`);
  console.log(`   Body preview: ${reply.body.substring(0, 120)}...`);

  // 5. Schedule for immediate delivery
  console.log('\n5. Scheduling email for immediate delivery...');
  const scheduleResult = await query(
    `INSERT INTO scheduled_emails (contact_id, to_email, subject, body, html_body, lead_type, scheduled_for)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     RETURNING id`,
    [contactId, TEST_EMAIL, reply.subject, reply.body, reply.htmlBody, contactType]
  );
  const emailId = scheduleResult.rows[0].id;
  console.log(`   Scheduled email #${emailId} for immediate pickup`);

  // 6. Find or create pipeline deal
  console.log('\n6. Updating pipeline deal...');
  let dealResult = await query(
    `SELECT * FROM pipeline_deals WHERE contact_id = $1 LIMIT 1`,
    [contactId]
  );

  let dealId: number;
  if (dealResult.rows.length > 0) {
    dealId = dealResult.rows[0].id;
    await query(
      `UPDATE pipeline_deals SET stage = 'contract_sent', probability = GREATEST(probability, 55),
       next_action = 'Follow up if unsigned after 5 business days', updated_at = NOW()
       WHERE id = $1`,
      [dealId]
    );
    console.log(`   Updated deal #${dealId} → contract_sent (55%)`);
  } else {
    const newDeal = await query(
      `INSERT INTO pipeline_deals (name, company, contact_id, type, stage, value, probability, next_action)
       VALUES ($1, $2, $3, $4, 'contract_sent', 25000, 55, 'Follow up if unsigned after 5 business days')
       RETURNING id`,
      [`${TEST_NAME} - Test`, 'Test Company', contactId, contactType]
    );
    dealId = newDeal.rows[0].id;
    console.log(`   Created deal #${dealId} → contract_sent (55%)`);
  }

  // 7. Log activity
  await query(
    `INSERT INTO activity_log (deal_id, activity_type, description, metadata)
     VALUES ($1, $2, $3, $4)`,
    [dealId, 'contract_docs_sent',
     `Contract documents sent to ${TEST_NAME} (${requestType} request) [TEST]`,
     JSON.stringify({ request_type: requestType, docs_included: reply.docsIncluded, from: TEST_EMAIL, test: true })]
  );
  console.log('   Logged contract_docs_sent activity');

  // 8. Upgrade contact status
  await query(
    `UPDATE contacts SET status = 'qualified', updated_at = NOW() WHERE id = $1 AND status != 'qualified'`,
    [contactId]
  );

  console.log('\n=== Done! ===');
  console.log(`Email #${emailId} is scheduled for immediate pickup.`);
  console.log(`Trigger the send-emails cron to deliver it to ${TEST_EMAIL}`);

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
