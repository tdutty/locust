/**
 * Generates professional placeholder contract PDFs with SweetLease branding.
 * Run: npx tsx scripts/generate-contract-pdfs.ts
 */

import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const OUTPUT_DIR = join(__dirname, '..', 'public', 'docs', 'contracts');
const ORANGE = rgb(0.918, 0.345, 0.047);   // #EA580C
const DARK = rgb(0.1, 0.1, 0.1);
const GRAY = rgb(0.4, 0.4, 0.4);
const LIGHT_GRAY = rgb(0.85, 0.85, 0.85);
const GREEN = rgb(0.086, 0.639, 0.290);

interface DocConfig {
  filename: string;
  title: string;
  subtitle: string;
  sections: { heading: string; body: string[] }[];
}

const DOCUMENTS: DocConfig[] = [
  {
    filename: 'sweetlease-nda.pdf',
    title: 'MUTUAL NON-DISCLOSURE AGREEMENT',
    subtitle: 'SweetLease, Inc.',
    sections: [
      {
        heading: '1. PURPOSE',
        body: [
          'This Mutual Non-Disclosure Agreement ("Agreement") is entered into by and between SweetLease, Inc. ("SweetLease") and the receiving party ("Recipient") for the purpose of protecting confidential information disclosed during business discussions related to partnership, integration, or service engagement.',
        ],
      },
      {
        heading: '2. DEFINITION OF CONFIDENTIAL INFORMATION',
        body: [
          '"Confidential Information" includes all non-public information disclosed by either party, whether orally, in writing, or electronically, including but not limited to: business plans, financial data, customer lists, tenant databases, pricing models, proprietary technology, algorithms, platform architecture, and partnership terms.',
          'Confidential Information does not include information that: (a) is or becomes publicly available through no fault of the receiving party; (b) was already known to the receiving party prior to disclosure; (c) is independently developed without use of Confidential Information; or (d) is disclosed with the prior written consent of the disclosing party.',
        ],
      },
      {
        heading: '3. OBLIGATIONS',
        body: [
          'Each party agrees to: (a) hold Confidential Information in strict confidence; (b) not disclose Confidential Information to any third party without prior written consent; (c) use Confidential Information solely for the purpose of evaluating and pursuing a potential business relationship; (d) limit access to Confidential Information to employees and advisors who have a need to know and are bound by confidentiality obligations no less protective than those contained herein.',
        ],
      },
      {
        heading: '4. TERM',
        body: [
          'This Agreement shall remain in effect for a period of two (2) years from the date of execution. The obligations of confidentiality shall survive termination of this Agreement for an additional period of two (2) years.',
        ],
      },
      {
        heading: '5. REMEDIES',
        body: [
          'Each party acknowledges that any breach of this Agreement may cause irreparable harm for which monetary damages may be inadequate. Accordingly, either party may seek equitable relief, including injunction and specific performance, in addition to any other remedies available at law or in equity.',
        ],
      },
      {
        heading: '6. GOVERNING LAW',
        body: [
          'This Agreement shall be governed by and construed in accordance with the laws of the State of Texas, without regard to its conflict of law principles.',
        ],
      },
      {
        heading: 'SIGNATURES',
        body: [
          'SweetLease, Inc.',
          'Name: ______________________________    Date: ______________',
          'Title:  ______________________________',
          '',
          'Recipient:',
          'Name: ______________________________    Date: ______________',
          'Title:  ______________________________',
          'Company: ___________________________',
        ],
      },
    ],
  },
  {
    filename: 'sweetlease-security-overview.pdf',
    title: 'SECURITY & COMPLIANCE OVERVIEW',
    subtitle: 'SweetLease Platform Security',
    sections: [
      {
        heading: '1. INFRASTRUCTURE SECURITY',
        body: [
          'SweetLease operates on enterprise-grade cloud infrastructure hosted on DigitalOcean with automatic failover, encrypted storage at rest (AES-256), and TLS 1.3 encryption for all data in transit. All production databases are isolated within private VPC networks with no public internet exposure.',
        ],
      },
      {
        heading: '2. DATA PROTECTION',
        body: [
          'All personally identifiable information (PII) is encrypted at rest and in transit. Access to production data is restricted to authorized personnel via role-based access control (RBAC) and multi-factor authentication (MFA). Database backups are encrypted and retained for 30 days with point-in-time recovery capability.',
        ],
      },
      {
        heading: '3. APPLICATION SECURITY',
        body: [
          'SweetLease follows OWASP Top 10 security guidelines. Our development process includes: automated dependency scanning, code review requirements for all production changes, input validation and parameterized queries to prevent injection attacks, Content Security Policy (CSP) headers, and regular penetration testing.',
        ],
      },
      {
        heading: '4. ACCESS CONTROL',
        body: [
          'Platform access is managed through role-based permissions with the principle of least privilege. Administrative access requires MFA and is logged for audit purposes. API authentication uses industry-standard OAuth 2.0 and JWT tokens with short expiration windows.',
        ],
      },
      {
        heading: '5. INCIDENT RESPONSE',
        body: [
          'SweetLease maintains a documented incident response plan that includes: 24-hour notification to affected parties for confirmed data breaches, root cause analysis and remediation tracking, regular tabletop exercises, and a dedicated security contact (security@sweetlease.io).',
        ],
      },
      {
        heading: '6. COMPLIANCE',
        body: [
          'SweetLease is committed to maintaining compliance with applicable data protection regulations including CCPA and state-level privacy laws. We conduct annual security assessments and are working toward SOC 2 Type II certification.',
        ],
      },
      {
        heading: '7. VENDOR MANAGEMENT',
        body: [
          'All third-party vendors with access to customer data undergo security assessment prior to onboarding. Vendor agreements include data processing requirements, breach notification obligations, and right-to-audit clauses.',
        ],
      },
    ],
  },
  {
    filename: 'sweetlease-landlord-listing-agreement.pdf',
    title: 'LANDLORD LISTING AGREEMENT',
    subtitle: 'SweetLease Property Partnership',
    sections: [
      {
        heading: '1. PARTIES',
        body: [
          'This Listing Agreement ("Agreement") is entered into between SweetLease, Inc. ("SweetLease") and the property owner or authorized representative ("Landlord") for the purpose of listing residential rental properties on the SweetLease platform.',
        ],
      },
      {
        heading: '2. LISTING TERMS',
        body: [
          'Landlord authorizes SweetLease to market and facilitate tenant placement for the designated properties. Landlord retains full authority over: rental pricing, tenant approval/denial, lease terms, and property management decisions. SweetLease will present pre-screened, employer-backed tenant candidates for Landlord review.',
        ],
      },
      {
        heading: '3. COMMISSION STRUCTURE',
        body: [
          'SweetLease charges a placement commission of 50% of one month\'s rent upon successful tenant placement — 25% below the industry standard. Commission is due only upon signed lease execution. No upfront costs, listing fees, or monthly charges apply. Landlord receives a detailed commission breakdown prior to each placement.',
        ],
      },
      {
        heading: '4. TENANT QUALITY GUARANTEE',
        body: [
          'All tenants presented through SweetLease are: pre-screened through background and credit verification, backed by active employment with corporate relocation support, and covered by employer lease guarantee programs where applicable. SweetLease maintains average tenant placement timelines of 7-14 business days.',
        ],
      },
      {
        heading: '5. TERM & TERMINATION',
        body: [
          'This Agreement is effective upon execution and continues for an initial term of twelve (12) months, automatically renewing for successive 12-month periods unless terminated by either party with 30 days written notice. Termination does not affect commissions due for placements completed during the term.',
        ],
      },
      {
        heading: '6. PROPERTY REQUIREMENTS',
        body: [
          'Landlord represents that listed properties: meet all applicable local housing codes and safety regulations, are accurately described regarding amenities, condition, and availability, and are available for occupancy as specified in the listing.',
        ],
      },
      {
        heading: 'SIGNATURES',
        body: [
          'SweetLease, Inc.',
          'Name: ______________________________    Date: ______________',
          '',
          'Landlord / Property Owner:',
          'Name: ______________________________    Date: ______________',
          'Property Address(es): _________________________________',
        ],
      },
    ],
  },
  {
    filename: 'sweetlease-employer-service-agreement.pdf',
    title: 'EMPLOYER SERVICE AGREEMENT',
    subtitle: 'SweetLease Corporate Housing Partnership',
    sections: [
      {
        heading: '1. PARTIES & PURPOSE',
        body: [
          'This Service Agreement ("Agreement") is entered into between SweetLease, Inc. ("SweetLease") and the employer organization ("Employer") for the purpose of providing housing placement services to Employer\'s relocating employees.',
        ],
      },
      {
        heading: '2. SERVICES PROVIDED',
        body: [
          'SweetLease will provide the following services at no cost to Employer: personalized housing search and matching for relocating employees, lease negotiation to secure rates $100-$300/month below market average, pre-screened and vetted landlord network with quality guarantees, end-to-end placement coordination including move-in logistics, and a dedicated account manager for ongoing support.',
        ],
      },
      {
        heading: '3. PRICING',
        body: [
          'SweetLease services are provided at zero cost to the Employer. SweetLease earns its revenue through landlord placement commissions. Employees benefit from negotiated below-market rental rates. No hidden fees, setup costs, or ongoing charges apply to the Employer.',
        ],
      },
      {
        heading: '4. EMPLOYEE ONBOARDING',
        body: [
          'Employer agrees to: provide SweetLease with relocating employee contact information (with employee consent), designate a primary HR or relocation contact for coordination, and communicate SweetLease availability to eligible relocating employees. SweetLease will handle all direct communication with employees regarding housing placement.',
        ],
      },
      {
        heading: '5. DATA HANDLING & PRIVACY',
        body: [
          'SweetLease will handle all employee personal information in accordance with applicable privacy laws. Employee data will be used solely for housing placement purposes and will not be shared with unauthorized third parties. SweetLease maintains enterprise-grade security controls as detailed in our Security Overview document.',
        ],
      },
      {
        heading: '6. TERM & TERMINATION',
        body: [
          'This Agreement is effective upon execution and continues until terminated by either party with 30 days written notice. Active employee placements in progress at the time of termination will be completed. No penalties apply for termination.',
        ],
      },
      {
        heading: 'SIGNATURES',
        body: [
          'SweetLease, Inc.',
          'Name: ______________________________    Date: ______________',
          '',
          'Employer:',
          'Name: ______________________________    Date: ______________',
          'Company: ___________________________',
          'Title:  ______________________________',
        ],
      },
    ],
  },
  {
    filename: 'sweetlease-university-institutional-agreement.pdf',
    title: 'INSTITUTIONAL PARTNERSHIP AGREEMENT',
    subtitle: 'SweetLease University & Residency Programs',
    sections: [
      {
        heading: '1. PARTIES & PURPOSE',
        body: [
          'This Institutional Partnership Agreement ("Agreement") is entered into between SweetLease, Inc. ("SweetLease") and the educational institution or residency program ("Institution") for the purpose of providing housing placement services to incoming students, residents, or fellows.',
        ],
      },
      {
        heading: '2. SERVICES PROVIDED',
        body: [
          'SweetLease will provide the following services at no cost to the Institution: housing search and placement for incoming cohorts, lease negotiation securing rates 15-25% below market average, furnished and unfurnished options from pre-screened landlord network, proximity matching to clinical sites, hospitals, and campus, branded housing portal for the Institution\'s program, and ongoing tenant support throughout lease terms.',
        ],
      },
      {
        heading: '3. PRICING',
        body: [
          'All SweetLease services are provided at zero cost to the Institution and to residents/students. SweetLease earns revenue through landlord commissions only. No fees, subscriptions, or charges apply to the Institution or its students at any time.',
        ],
      },
      {
        heading: '4. INSTITUTION RESPONSIBILITIES',
        body: [
          'Institution agrees to: share incoming cohort contact information (with participant consent), designate a program coordinator as primary point of contact, include SweetLease materials in orientation or onboarding communications, and provide feedback on housing needs specific to the program\'s participant population.',
        ],
      },
      {
        heading: '5. BRANDED HOUSING PORTAL',
        body: [
          'SweetLease will create a co-branded housing portal page for the Institution\'s program, featuring: Institution logo and program name, curated listings near program sites, direct access to SweetLease placement team, and program-specific housing guides and resources.',
        ],
      },
      {
        heading: '6. TERM & TERMINATION',
        body: [
          'This Agreement is effective upon execution and continues for an initial term aligned with the Institution\'s academic or program year, automatically renewing unless terminated by either party with 60 days written notice. No penalties apply for termination.',
        ],
      },
      {
        heading: 'SIGNATURES',
        body: [
          'SweetLease, Inc.',
          'Name: ______________________________    Date: ______________',
          '',
          'Institution:',
          'Name: ______________________________    Date: ______________',
          'Institution: _________________________',
          'Title:  ______________________________',
        ],
      },
    ],
  },
  {
    filename: 'sweetlease-data-processing-agreement.pdf',
    title: 'DATA PROCESSING AGREEMENT',
    subtitle: 'SweetLease Data Protection Terms',
    sections: [
      {
        heading: '1. PARTIES & SCOPE',
        body: [
          'This Data Processing Agreement ("DPA") is entered into between SweetLease, Inc. ("Processor") and the organization providing personal data ("Controller") to establish the terms under which SweetLease processes personal data on behalf of the Controller in connection with housing placement services.',
        ],
      },
      {
        heading: '2. DATA PROCESSED',
        body: [
          'Categories of personal data processed include: employee/resident names and contact information, employment or enrollment verification data, housing preferences and requirements, financial information necessary for lease qualification, and communication records related to housing placement. SweetLease does not process sensitive categories of data (health, biometric, racial/ethnic origin) unless explicitly required and authorized.',
        ],
      },
      {
        heading: '3. PROCESSING OBLIGATIONS',
        body: [
          'SweetLease shall: process personal data only on documented instructions from the Controller, ensure personnel authorized to process data are bound by confidentiality obligations, implement appropriate technical and organizational security measures, assist the Controller in responding to data subject requests, delete or return all personal data upon termination of services (at Controller\'s election), and make available all information necessary to demonstrate compliance.',
        ],
      },
      {
        heading: '4. SUB-PROCESSORS',
        body: [
          'SweetLease maintains a list of approved sub-processors and will notify the Controller of any intended additions or changes. Current sub-processors include: cloud infrastructure provider (DigitalOcean), email delivery service (Resend), and payment processing (Stripe). Controller may object to new sub-processors within 14 days of notification.',
        ],
      },
      {
        heading: '5. DATA SECURITY',
        body: [
          'SweetLease implements and maintains security measures including: encryption at rest (AES-256) and in transit (TLS 1.3), access controls with role-based permissions and MFA, regular security assessments and penetration testing, automated monitoring and alerting for security events, and documented incident response procedures.',
        ],
      },
      {
        heading: '6. BREACH NOTIFICATION',
        body: [
          'SweetLease will notify the Controller without undue delay (and in no event later than 72 hours) after becoming aware of a personal data breach. Notification will include: the nature of the breach, categories and approximate number of data subjects affected, likely consequences, and measures taken or proposed to address the breach.',
        ],
      },
      {
        heading: '7. DATA RETENTION & DELETION',
        body: [
          'Personal data is retained only for the duration necessary to fulfill the housing placement services. Upon termination of the service agreement or upon Controller request, SweetLease will securely delete all personal data within 30 days, unless retention is required by law.',
        ],
      },
      {
        heading: 'SIGNATURES',
        body: [
          'SweetLease, Inc. (Processor)',
          'Name: ______________________________    Date: ______________',
          '',
          'Controller:',
          'Name: ______________________________    Date: ______________',
          'Company: ___________________________',
          'Title:  ______________________________',
        ],
      },
    ],
  },
];

async function generatePDF(doc: DocConfig): Promise<void> {
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const PAGE_WIDTH = 612; // US Letter
  const PAGE_HEIGHT = 792;
  const MARGIN_LEFT = 60;
  const MARGIN_RIGHT = 60;
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
  const MARGIN_TOP = 60;
  const MARGIN_BOTTOM = 60;

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN_TOP;

  function newPage(): PDFPage {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN_TOP;
    return page;
  }

  function ensureSpace(needed: number) {
    if (y - needed < MARGIN_BOTTOM) {
      newPage();
    }
  }

  function drawWrappedText(text: string, font: PDFFont, size: number, color: typeof DARK, lineHeight: number): void {
    const words = text.split(' ');
    let line = '';
    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      const width = font.widthOfTextAtSize(testLine, size);
      if (width > CONTENT_WIDTH && line) {
        ensureSpace(lineHeight);
        page.drawText(line, { x: MARGIN_LEFT, y, size, font, color });
        y -= lineHeight;
        line = word;
      } else {
        line = testLine;
      }
    }
    if (line) {
      ensureSpace(lineHeight);
      page.drawText(line, { x: MARGIN_LEFT, y, size, font, color });
      y -= lineHeight;
    }
  }

  // ─── Header bar ───
  page.drawRectangle({
    x: 0, y: PAGE_HEIGHT - 8, width: PAGE_WIDTH, height: 8,
    color: ORANGE,
  });

  // ─── Logo text ───
  y = PAGE_HEIGHT - MARGIN_TOP - 10;
  page.drawText('SWEET', { x: MARGIN_LEFT, y, size: 28, font: helveticaBold, color: ORANGE });
  const sweetWidth = helveticaBold.widthOfTextAtSize('SWEET', 28);
  page.drawText('LEASE', { x: MARGIN_LEFT + sweetWidth, y, size: 28, font: helveticaBold, color: DARK });
  y -= 20;

  // ─── Divider ───
  page.drawLine({
    start: { x: MARGIN_LEFT, y },
    end: { x: PAGE_WIDTH - MARGIN_RIGHT, y },
    thickness: 1.5,
    color: LIGHT_GRAY,
  });
  y -= 30;

  // ─── Title ───
  drawWrappedText(doc.title, helveticaBold, 18, DARK, 24);
  y -= 6;
  drawWrappedText(doc.subtitle, helvetica, 11, GRAY, 16);
  y -= 8;

  // ─── Date line ───
  const dateStr = `Effective Date: _______________     Document Version: 1.0`;
  page.drawText(dateStr, { x: MARGIN_LEFT, y, size: 9, font: helvetica, color: GRAY });
  y -= 24;

  // ─── Divider ───
  page.drawLine({
    start: { x: MARGIN_LEFT, y },
    end: { x: PAGE_WIDTH - MARGIN_RIGHT, y },
    thickness: 0.5,
    color: LIGHT_GRAY,
  });
  y -= 20;

  // ─── Sections ───
  for (const section of doc.sections) {
    ensureSpace(40);

    // Section heading
    drawWrappedText(section.heading, helveticaBold, 11, DARK, 16);
    y -= 4;

    // Section body
    for (const para of section.body) {
      if (para === '') {
        y -= 10;
        continue;
      }
      drawWrappedText(para, helvetica, 10, GRAY, 14);
      y -= 8;
    }

    y -= 10;
  }

  // ─── Footer ───
  ensureSpace(40);
  y -= 10;
  page.drawLine({
    start: { x: MARGIN_LEFT, y },
    end: { x: PAGE_WIDTH - MARGIN_RIGHT, y },
    thickness: 0.5,
    color: LIGHT_GRAY,
  });
  y -= 16;
  const footerText = 'SweetLease, Inc.  |  sweetlease.io  |  rgilbert@sweetlease.io  |  CONFIDENTIAL';
  const footerWidth = helvetica.widthOfTextAtSize(footerText, 8);
  page.drawText(footerText, {
    x: (PAGE_WIDTH - footerWidth) / 2,
    y,
    size: 8,
    font: helvetica,
    color: GRAY,
  });

  // Add page numbers
  const pages = pdfDoc.getPages();
  for (let i = 0; i < pages.length; i++) {
    const pageNum = `Page ${i + 1} of ${pages.length}`;
    const numWidth = helvetica.widthOfTextAtSize(pageNum, 8);
    pages[i].drawText(pageNum, {
      x: PAGE_WIDTH - MARGIN_RIGHT - numWidth,
      y: MARGIN_BOTTOM - 20,
      size: 8,
      font: helvetica,
      color: GRAY,
    });
  }

  const bytes = await pdfDoc.save();
  const outputPath = join(OUTPUT_DIR, doc.filename);
  writeFileSync(outputPath, bytes);
  console.log(`  Generated: ${doc.filename} (${(bytes.length / 1024).toFixed(1)} KB, ${pages.length} page${pages.length > 1 ? 's' : ''})`);
}

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log('Generating SweetLease contract PDFs...\n');

  for (const doc of DOCUMENTS) {
    await generatePDF(doc);
  }

  console.log('\nAll PDFs generated in public/docs/contracts/');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
