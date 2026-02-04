# Locust - AI Account Executive

AI-powered outbound sales platform for SweetLease. Part of the SweetLease ecosystem alongside Grasshopper (Landlord CRM) and Cricket (Employer CRM).

## Features

- **Email Outreach** - Generate and send cold outbound email sequences
- **Inbox Monitoring** - AI-powered email classification and response suggestions
- **CRM Integration** - Connect with Grasshopper (landlords) and Cricket (employers)
- **Sales Pipeline** - Track deals through qualification stages
- **Analytics** - Monitor outreach performance and conversion metrics

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Porkbun SMTP/IMAP for email
- JWT authentication

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local

# Run development server
npm run dev
```

Open http://localhost:3002

## Environment Variables

```
SMTP_HOST=smtp.porkbun.com
SMTP_PORT=587
SMTP_USER=tgilbert@sweetlease.io
SMTP_PASSWORD=your-password
IMAP_HOST=imap.porkbun.com
IMAP_PORT=993
GRASSHOPPER_API_URL=http://localhost:8080
CRICKET_API_URL=http://localhost:8081
JWT_SECRET=your-jwt-secret
```

## Login Credentials

- Email: admin@sweetlease.io
- Password: locust2024

## Deployment

Configured for DigitalOcean App Platform. See `.do/app.yaml` for deployment configuration.

```bash
npm run build
npm start
```

## Related Projects

- [SweetLease](https://github.com/tdutty/sweetlease) - Main platform
- Grasshopper - Landlord CRM
- Cricket - Employer CRM
