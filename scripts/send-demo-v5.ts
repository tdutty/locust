import { config } from 'dotenv';
config({ path: '.env.local' });

import nodemailer from 'nodemailer';
import { generateReply, OriginalEmail } from '../src/lib/reply-generator';

const TO = 'terrellgilb5@gmail.com';

const demoEmails: OriginalEmail[] = [
  {
    from: 'Sarah Mitchell',
    fromEmail: 'sarah@landlordexample.com',
    subject: 'Interested in SweetLease for my properties',
    body: 'Hi, I have several rental properties in Austin and I am interested in learning more about your platform. Can we schedule a call?',
    classification: 'interested',
    contactType: 'landlord',
  },
  {
    from: 'Tesla HR',
    fromEmail: 'hr@teslaexample.com',
    subject: 'Re: Housing assistance for relocating employees',
    body: 'Hi Terrell, this sounds interesting. We have a large number of employees relocating to Austin. Can you tell us more about how the program works?',
    classification: 'interested',
    contactType: 'employer',
  },
  {
    from: 'Dr. James Rivera',
    fromEmail: 'jrivera@university.edu',
    subject: 'Housing resource for incoming residents',
    body: 'We are looking for housing support for our incoming medical residents. How does the SweetLease program work for residency programs?',
    classification: 'question',
    contactType: 'residency',
  },
  {
    from: 'Mark Thompson',
    fromEmail: 'mark@propertygroup.com',
    subject: 'Re: SweetLease partnership',
    body: 'Thanks but we are not looking for new platforms at this time. We have existing relationships that are working fine.',
    classification: 'objection',
    contactType: 'landlord',
  },
  {
    from: 'Amazon Benefits Team',
    fromEmail: 'benefits@amazonexample.com',
    subject: 'Re: Employee housing benefit',
    body: 'We appreciate the outreach but this is not something we are looking to implement right now.',
    classification: 'not_interested',
    contactType: 'employer',
  },
];

async function main() {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.porkbun.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASSWORD! },
  });

  await transporter.verify();
  console.log('SMTP connected\n');

  for (const email of demoEmails) {
    try {
      const reply = await generateReply(email);
      if (!reply) {
        console.log(`SKIP: ${email.from} (${email.classification})`);
        continue;
      }

      const label = `[${email.contactType?.toUpperCase()}/${email.classification.toUpperCase()}]`;
      await transporter.sendMail({
        from: `"Terrell Gilbert" <${process.env.SMTP_USER}>`,
        to: TO,
        subject: `SweetLease Demo v5 ${label} — ${reply.subject}`,
        text: reply.body,
        html: reply.htmlBody,
      });

      console.log(`SENT: ${label} from "${email.from}" — ${reply.source}`);
    } catch (err) {
      console.error(`FAIL: ${email.from}`, err);
    }
  }

  console.log('\nDone!');
  process.exit(0);
}

main();
