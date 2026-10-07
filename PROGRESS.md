# GiftLedger progress log

Read this with `CLAUDE.md` at the start of every session. Newest stage first.

## Where we are
- **Current stage:** 3: AI gift ideas (next)
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
| **Now** | **GitHub access: push was refused (403). Reconnect GitHub at https://claude.ai/connect-github and install the Claude GitHub App on `aether`. Until then work is only saved inside the container.** | **blocking pushes** |
| Now | Start the Stripe account (test mode is enough for now) | waiting |
| By Oct 15 | Anthropic API key → cloud environment as `APP_ANTHROPIC_API_KEY` (owner adds credits personally) | waiting |
| By Oct 15 | Allow domains in the cloud environment's network settings: `*.supabase.co`, `api.supabase.com`, `*.stripe.com`, `*.stripe.network`, `*.stripecdn.com`, `api.resend.com`, `*.posthog.com`, `*.sentry.io` | waiting |
| By Oct 21 | Stripe test keys + Season Pass price ID → cloud environment | waiting |
| By Oct 14–17 | Supabase project (US East) + Vercel connected to GitHub | waiting |
| By Oct 18 | Google Cloud sign-in setup (Claude sends steps) | waiting |
| By Oct 20 | Final name + domain (owner buys) | waiting |
| Later | Paid plans (Vercel/Supabase/Resend Pro), Stripe live mode: owner does personally | deferred by owner |

---

## Stage 2: People, gifts and the dashboard ✅ (Oct 7)

**Plan:** see the git history of this file. In short:
- pages for the dashboard, onboarding, people and gifts;
- pure tested logic for money, budgets and dates;
- one additive migration;
- an active-list cookie.

**Done**
- **Dashboard (`/app`):**
  - spent, left (or over) and the total budget, with a colored bar;
  - "N of M still need a gift" and the amount not yet assigned to anyone;
  - people listed "still needs a gift" first, each with their own colored bar;
  - an archived section, and an empty state;
  - the owner can edit the total budget in a dialog.
- **Onboarding (`/app/welcome`):** total budget (optional), then the first person, then their page. It saves the browser's time zone, and "Skip setup" is always there. The AI step is wired in Stage 3.
- **People:**
  - add, edit, archive/unarchive, and delete with an "are you sure?" step;
  - relationship from a list, or your own words;
  - budget, age range, interests as tags, notes, and don't-buy notes;
  - only the owner can change people (the app checks, and so does the database).
- **Gifts:**
  - quick add (title + price) on the person's page;
  - one-tap "Mark bought → wrapped → given", updated instantly on screen and then saved;
  - a full edit form: price × quantity, status, bought by, store, dates, link, notes;
  - entering a store with no return-by date fills in 30 days after purchase (editable);
  - marking a gift bought fills in today's date in the person's time zone;
  - return-by badges count down the days.
- **Free limit:** at 5 people the Add button is replaced by "You've added 5 people. Unlock unlimited people for $9.99." The database blocks a 6th either way. `/app/upgrade` is a placeholder until Stage 5.
- **Migration `20261008000000_stage2.sql`:**
  - `list_plan()`;
  - `set_gift_status()` now also fills in the purchase date;
  - only real time-zone names are accepted.
- **Logic, as pure tested functions:**
  - `src/lib/money.ts`: whole cents, no floating-point errors;
  - `src/lib/budget.ts`;
  - `src/lib/dates.ts`;
  - `src/lib/validation.ts`: all form input checked on the server with Zod.

**Checks (all run, all passing)**
- Type check, lint, production build: clean.
- Unit tests: 54 (money, budget colors and totals, sorting, time zones including the Nov 1 clock change, return-by dates, form validation).
- Database security tests: 24 (unchanged, still passing).
- Browser tests: 32 (16 flows × phone + desktop), with a clean console in every test. The flows:
  - onboarding;
  - quick add, one-tap status, and totals updating immediately (including going over budget);
  - sorting;
  - the return-by suggestion;
  - the free limit prompt;
  - archive, unarchive and delete with confirmation;
  - wrong input;
  - a second user getting a 404 on the first user's person;
  - the empty state;
  - plus all the Stage 1 sign-in flows.
- Screens checked by screenshot: phone, desktop, dark mode.

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
- **Native pickers on phones:** relationship, age range and status use the phone's own picker (fast and familiar) instead of a custom dropdown.
- **Money input** accepts "25", "24.99", "$1,299.99" and is stored as whole cents.
- **Gift edits by members:** members can edit and delete only gifts they added. Status can be changed by anyone who can see the gift.
- **Linking yourself as a person:** the owner can no longer read that row back after linking (by design), so the app must not ask for the row back after saving that link.

## Known issues
- `npm audit` reports 5 "high" issues, all in development-only lint tooling (`braces`, used by `eslint-config-next`), with no fixed version yet. `npm audit --omit=dev` (what ships to users) reports 0. Re-check before launch.
- Terms and Privacy pages are placeholders until Stage 8.
- Production Supabase needs the sign-in email template pasted into its dashboard (Stage 6 checklist).

## Next step
Stage 3, AI gift ideas:
- server route with the Anthropic SDK and a Zod-checked 5-idea format, retrying once if the answer comes back malformed;
- names scrubbed from notes;
- free (10) and paid (100) limits per list, a 10-per-minute rate limit, and failures don't use up a request;
- the ideas screen, "Save as gift idea", "More like this" and "Different direction";
- wiring onboarding step 3.

Real AI calls need the Anthropic key. Until it's added, everything is built and tested with the AI service swapped for a stand-in in tests only.
