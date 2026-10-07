# GiftLedger

A mobile-friendly holiday gift planner: a budget per person, AI gift ideas, a shared family list so nobody buys duplicates, and return-window reminders.

- Project brief and decisions: [`CLAUDE.md`](CLAUDE.md)
- Progress, known issues and next steps: [`PROGRESS.md`](PROGRESS.md)
- Every setting and key, and where to find it: [`.env.example`](.env.example)

## Run it locally
You need Node.js 22 and Docker.

```bash
npm install
npm run db:start     # local database + sign-in service in Docker
npm run env:local    # writes .env.local for local development
npm run dev          # http://localhost:3000
```
Sign-in emails sent locally land in the test inbox at http://127.0.0.1:54324.

## Checks
```bash
npm run check        # type check, lint, unit + database security tests, production build
npm run test:e2e     # browser tests at phone (375px) and desktop (1280px) widths
```

A full deployment guide (Vercel, Supabase, Stripe, Resend) is added before launch.
