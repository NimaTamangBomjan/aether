# GiftLedger progress log

Read this with `CLAUDE.md` at the start of every session. Newest stage first.

## Where we are
- **Current stage:** 2: Recipients, gifts and the dashboard (starting)
- **Launch:** Tue Nov 10, 2026. Build days Oct 8 – Nov 4, buffer Nov 5–9.
- **Last updated:** Oct 7, 2026

## How to resume in a fresh session
```bash
npm install
# start Docker if it isn't running (cloud container): dockerd > /tmp/dockerd.log 2>&1 &
npm run db:start      # local Supabase in Docker (first run downloads images, a few minutes)
npm run env:local     # writes .env.local from the local database + any keys in the environment
npm run check         # typecheck, lint, unit + database tests, production build
npm run test:e2e      # browser tests at 375px and 1280px (builds and starts the app)
```
Local test inbox (sign-in emails): http://127.0.0.1:54324

## Needs from the owner (see the kickoff plan, section 3)
| When | What | Status |
|---|---|---|
| Now | Start the Stripe account (test mode is enough for now) | waiting |
| By Oct 15 | Anthropic API key → cloud environment as `APP_ANTHROPIC_API_KEY` (owner adds credits personally) | waiting |
| By Oct 15 | Allow domains in the cloud environment's network settings: `*.supabase.co`, `api.supabase.com`, `*.stripe.com`, `*.stripe.network`, `*.stripecdn.com`, `api.resend.com`, `*.posthog.com`, `*.sentry.io` | waiting |
| By Oct 21 | Stripe test keys + Season Pass price ID → cloud environment | waiting |
| By Oct 14–17 | Supabase project (US East) + Vercel connected to GitHub | waiting |
| By Oct 18 | Google Cloud sign-in setup (Claude sends steps) | waiting |
| By Oct 20 | Final name + domain (owner buys) | waiting |
| Later | Paid plans (Vercel/Supabase/Resend Pro), Stripe live mode: owner does personally | deferred by owner |

---

## Stage 1: Project setup, schema, auth, row-level security, tests ✅ (Oct 7)

**Plan:** Next.js + TypeScript (strict) + Tailwind + shadcn/ui skeleton; local Supabase; database migration with every table, security rule and core action from the approved plan; sign-in by emailed code or link; tests for security rules (Vitest) and sign-in (Playwright, phone + desktop).
**Risks noted:** new Next.js version (16.4) with changed conventions; blocked network for some services; sign-in on phones.

**Done**
- App skeleton: Next.js 16.4 (App Router, Turbopack), React 19, TypeScript strict, Tailwind 4, shadcn/ui components in `src/components/ui`.
- Warm light + dark theme (`src/app/globals.css`), Figtree font, 44px+ tap targets, 16px inputs (no zoom on iPhone).
- Database: `supabase/migrations/20261007000000_init.sql`. 11 tables, all with row-level security; helper functions in a private schema; column-level permissions; triggers for new accounts (profile + own list), the 5-person free limit, status tracking; actions `accept_invite`, `set_gift_status`, `list_member_names`.
- Sign-in: email → 6-digit code (or the button in the email, which works in any browser). `src/app/sign-in`, `src/app/auth/confirm`. The email template is at `supabase/templates/sign-in.html`.
- `src/proxy.ts` refreshes the session and sends signed-out visitors from `/app/*` to sign-in. Redirects only go to our own site (`src/lib/safe-next.ts`).
- Placeholder home, Terms and Privacy pages (real ones in Stage 8).
- `.env.example` documents every key; `scripts/local-env.sh` writes `.env.local`.

**Checks (all run, all passing)**
- `npm run typecheck`, `npm run lint`, `npm run build`: clean.
- Unit tests: 6 passing (safe redirects).
- Database security tests: 24 passing (`tests/db/rls.test.ts`), covering:
  - a stranger can't read or change anything, and someone signed out sees nothing;
  - nobody can give themselves a Season Pass or write payments, AI usage or reminder logs;
  - the 6th person on a free list is blocked (archived people count), and allowed with a pass;
  - invites: single use, expiry, the 1-member free limit, only the owner invites, the token itself is never stored;
  - member permissions;
  - hidden gifts stay hidden, including the person linked to a member and surprises for the owner.
- I also broke two rules on purpose to check the tests catch it: 4 tests failed as expected, and passed again after restoring.
- Browser tests: 14 passing (7 flows × phone 375px + desktop 1280px). They cover:
  - a signed-out visitor is redirected;
  - sign-up with the code;
  - the email link opened in a different browser;
  - a broken link, a bad email or a wrong code each show a friendly message;
  - sign-out;
  - 44px tap targets;
  - no browser console errors or warnings in any test.
- Screens checked by screenshot in light and dark mode.

---

## Decisions (small ones made without asking)
- **Rendering model:** Next.js "Cache Components" is turned off. Every signed-in page is personal and rendered per request; the classic model is simpler and avoids a class of caching bugs. Static pages (home, legal) are still prerendered.
- **shadcn/ui:** the component website is blocked from the container, so components were copied from the shadcn GitHub source (identical code). The aliases are in `components.json`.
- **Playwright pinned to 1.56.1** to match the Chromium preinstalled in the container.
- **Local Supabase runs only what we need:** database, auth, API gateway, REST, test inbox. Images come from Docker Hub because the default registry is blocked.
- **Sign-in link:** verifies a one-time token (`token_hash`) rather than the browser-bound flow, so it works when the email opens in another browser or outside the installed app.
- **Tests sign in test users with passwords created through the admin API.** The app itself never shows a password option.
- **Linking yourself as a person:** the owner can no longer read that row back after linking (by design), so the app must not ask for the row back after saving that link.

## Known issues
- `npm audit` reports 5 "high" issues, all in development-only lint tooling (`braces`, used by `eslint-config-next`), with no fixed version yet. `npm audit --omit=dev` (what ships to users) reports 0. Re-check before launch.
- Terms and Privacy pages are placeholders until Stage 8.
- Production Supabase needs the sign-in email template pasted into its dashboard (Stage 6 checklist).

## Next step
Stage 2:
- people (add, edit, delete, archive, with the free limit shown in a friendly way);
- gifts (quick-add, one-tap status, suggested return-by date);
- the dashboard (totals, colors, "still needs a gift" first);
- 3-step onboarding.
