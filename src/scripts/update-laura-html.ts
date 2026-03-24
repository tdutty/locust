import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { fetchCalcomSlots, buildTimeSlotsHtml, buildOutboundHtml } from '../lib/email-templates';
import fs from 'fs';

const body = `Hi Laura,

Quick note on how this would work with SDN. The integration is as light as you want it to be — a link in the residency relocation resources, a pinned thread, a co-branded landing page. We build it, we maintain it, and SDN gets to offer its community something no one else has: an actual housing marketplace, not another financial product that helps them borrow more.

Match Day is March 20. If we connect this week I can have a working demo ready before the scramble starts.

Best,
Robert Gilbert`;

async function main() {
  const slots = await fetchCalcomSlots();
  if (!slots) { console.error('No slots'); process.exit(1); }
  console.log('Slots:', slots.map(s => `${s.date} ${s.displayTime}`).join(', '));

  let html = buildOutboundHtml(body);
  const slotsHtml = buildTimeSlotsHtml(slots);
  html = html.replace(
    '<div style="border-top:1px solid #e2e8f0;padding-top:16px;margin-top:4px;">',
    `${slotsHtml}<div style="border-top:1px solid #e2e8f0;padding-top:16px;margin-top:4px;">`
  );

  fs.writeFileSync('/tmp/laura-html.txt', html);
  console.log('HTML written to /tmp/laura-html.txt');
}

main().catch(err => { console.error(err); process.exit(1); });
