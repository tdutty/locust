import { config } from 'dotenv';
config({ path: '.env.local' });

import { generateReply, OriginalEmail } from '../src/lib/reply-generator';

const email: OriginalEmail = {
  from: 'Dr. James Rivera',
  fromEmail: 'jrivera@university.edu',
  subject: 'Housing resource for incoming residents',
  body: 'We are looking for housing support for our incoming medical residents. How does the SweetLease program work for residency programs?',
  classification: 'question',
  contactType: 'residency',
};

async function main() {
  const reply = await generateReply(email);
  if (!reply) { console.log('No reply generated'); process.exit(1); }

  console.log('=== SOURCE:', reply.source, '===\n');
  console.log('=== PLAIN TEXT BODY ===');
  console.log(reply.body);
  console.log('\n=== HTML BODY ===');
  console.log(reply.htmlBody);
}

main();
