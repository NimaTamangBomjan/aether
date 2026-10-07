# GiftLedger progress log

Read this with `CLAUDE.md` at the start of every session. Newest stage first.

## Where we are
- **Current stage:** 10 ✅ built and tested. All 10 stages are done; what's left needs the owner (keys, accounts, domain, headline, legal review, purchases). See "Needs from the owner" and the launch checklist below.
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
| By Oct 21 | Cloudflare account (free) → Turnstile widget: Site Key → Vercel `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, Secret Key → Supabase CAPTCHA (README step 1.9) | waiting |
| By Oct 20 | Final name + domain (owner buys) | waiting |
| Later | Paid plans (Vercel/Supabase/Resend Pro), Stripe live mode: owner does personally | deferred by owner |

---

## Launch checklist (CLAUDE.md §12) and acceptance criteria

**Acceptance criteria**

| § | Criterion | Status |
|---|---|---|
| 6.1 | A new user reaches their first AI idea in under 2 minutes | ✅ tested (about 3 seconds against the AI stand-in; the real AI adds ~3–6 s) |
| 6.2 | Totals update immediately when a gift's price or status changes; colors; sorting | ✅ tested |
| 6.3 | Free users blocked at the 6th person on the server | ✅ database-enforced and tested |
| 6.4 | Spent counts only Bought, Wrapped and Given; 30-day return-by suggestion | ✅ tested |
| 6.5 | A failed or slow AI call shows a friendly message and doesn't use up a request | ✅ tested. ⏳ Real-AI quality check on 10 profiles needs the key (`npm run test:ai-live`) |
| 6.6 | A hidden gift never shows up for that member in any page, API response or email | ✅ tested: pages, page source, direct links, REST/RPC, export, reminder emails |
| 6.7 | Running the reminder job twice the same day sends nothing extra | ✅ tested |
| 6.8 | Stripe test cards, including a declined card | ⏳ Webhook logic fully tested with Stripe-signed events. Real Checkout with test cards: `tests/e2e/stripe-live.spec.ts`, ready once Stripe test keys and domains are added |
| 6.9 | Settings, export, account deletion | ✅ tested |
| 6.10 | Landing page sections, SEO, Lighthouse 90+ mobile | ✅ 97–98 performance, 100 accessibility/best practices/SEO. ⏳ Headline choice (owner) |
| 6.11 | Legal pages linked, under-13 statement, minimal cookies, contact email | ✅ drafts. ⏳ Owner review, and `NEXT_PUBLIC_SUPPORT_EMAIL` |

**Definition of done (§12)**

| Item | Status |
|---|---|
| Playwright: sign up → person → AI ideas → save gift → invite → upgrade → reminder email | ✅ `tests/e2e/journey.spec.ts` passes at phone and desktop sizes. The payment step uses Stripe's signed webhook; the real Checkout test runs once keys exist |
| Stripe live mode; one real $9.99 purchase tested and refunded | ⏳ Owner, with Claude (deferred by the owner: no card use by Claude) |
| Custom domain with HTTPS; sending domain verified (SPF/DKIM) | ⏳ Owner buys the domain; steps in README |
| Privacy Policy and Terms reviewed | ⏳ Owner |
| Sentry and PostHog receiving data | ⏳ Needs keys (code ready and tested against stand-ins) |
| README explains setup, deploying and every key | ✅ `README.md` |

**After launch (§20)**
- "Send feedback" link: ✅ in Settings (needs `NEXT_PUBLIC_SUPPORT_EMAIL`).
- Daily Supabase backups: ⏳ Supabase Pro (owner).
- Sentry alerts to email: ⏳ owner setting (README step 7).
- `LAUNCH.md`: ✅

---

## Stage 10: Full journey test, security review #2, README, launch plan ✅ (Oct 7)

**Done**
- **Journey test** (`tests/e2e/journey.spec.ts`, phone and desktop sizes): sign up → add a person → AI ideas → save an idea → invite a family member who joins → upgrade (Stripe-signed webhook) → the family member marks it bought → the return reminder email arrives.
- **Google sign-in** (behind `NEXT_PUBLIC_GOOGLE_SIGN_IN=1`), with `/auth/callback`, a safe redirect, and a clear message if Google fails.
- **Security review #2** by a separate agent: everything fixed (section above).
- **Sign-in CAPTCHA** (Cloudflare Turnstile) ready to switch on, and a daily tidy-up job.
- **`README.md`:** plain-language setup, the deploy steps for every service, where every key lives, and troubleshooting.
- **`LAUNCH.md`:** launch-week plan, short-video ideas, posts to copy, where to share, what to watch.

**Checks**
- Typecheck, lint and production build pass; the browser console stays clean on every page tested.
- Unit and database tests: 187 passing.
- Browser tests: see the run recorded under Security review #2's checks below.

---

## Security review #2 (CLAUDE.md §15, before launch) ✅ fixed (Oct 7)

A second, separate review agent re-attacked the whole app with throwaway users against the local stack and a production build, and changed no files.
- No Critical or High findings.
- All review #1 fixes held up against fresh bypass attempts.
- Everything it found is fixed below, with regression tests:
  - `tests/db/security-review-2.test.ts` (13 tests);
  - unit tests for the scrubbing, email and validation changes;
  - browser tests for unsubscribe, invites, analytics and the CAPTCHA.
- Migration: `20261015000000_security_review_2.sql`.
- For the database fixes (M1, L3, L4), I proved each test fails with the fix switched off and passes with it on.

| # | Finding | Fix |
|---|---|---|
| M1 | A signed-in session could set a password (Supabase's "update user" endpoint), giving someone with a few minutes in a family member's browser a permanent backdoor. Changing the account's email to a victim's address (who clicks one link) handed over their future sign-ins. | Any password set is replaced with random bytes nobody knows, every time. Email changes are refused by the database. Supabase still sends its "change email" and "reset password" emails before checking, so both templates now contain no links. "Secure password change" is on. |
| M2 | Invite tokens reached PostHog in `$pathname`. | Every analytics property is cleaned: no query strings, fragments or invite tokens, even URL-encoded inside another address. Invite, unsubscribe and sign-in pages aren't tracked at all. A browser test opens an invite link and checks the token never leaves. |
| M3 | Email apps' own one-click "Unsubscribe" button posted to the page, which did nothing. | `List-Unsubscribe` now points at `/api/unsubscribe` (the RFC 8058 endpoint); the link in the email body still opens the page. A browser test presses the one-click button the way Gmail does. |
| M4 | "Email an invite" could be used to send spam or phishing from GiftLedger's domain (attacker-chosen name and list name in the subject and body). | Fixed subject and no list name. The inviter's name appears only if it's plain letters. 3 invite emails a day per account (10 with the pass). The same address can't be emailed twice in a day by anyone, or within 30 days by the same account. Everything pauses at 500 a day across the app, and the owner gets an email. Only a one-way fingerprint of each address is kept, for 30 days. Display names can't contain web or email addresses. |
| M5 | Supabase's email limit is one shared budget for the whole project, and anyone can request codes for any address. The checklist said the limits were per visitor, which is wrong. | Cloudflare Turnstile support was added to the sign-in form (on when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set). All browser tests run with it on, against a local stand-in. The daily job removes sign-ups never finished within a day. The production checklist is corrected, with the dashboard steps. |
| L1 | Error reports could still carry an invite token (`contexts.nextjs.request_path`), query strings in navigation and network breadcrumbs, and people's names in click labels. | The same cleaning runs on every part of a report, including breadcrumbs. Click and typing breadcrumbs are dropped. |
| L2 | Line breaks in names and titles (possible straight through the database API) went raw into email subjects. | Database checks refuse control characters in gift titles and stores, people's names, display names and list names. Forms turn pasted line breaks into spaces. Every subject is forced onto one line before sending. |
| L3 | A partial refund that arrived before the payment event left the pass in place after a later full refund. | The payment is attached to whatever refund row arrived first, so a later full refund removes the pass. |
| L4 | After account deletion, Supabase's sign-in log still held the email and id; the Privacy Policy said everything was deleted. | Deleting an account deletes its sign-in log lines. The daily job keeps sign-in logs for 30 days only. The Privacy Policy draft now says what's kept, where and for how long. |
| L5 | The display name came from whatever "full name" was attached to a sign-up, so someone pre-registering your email chose the name your family sees. | The name is taken only from Google. Everyone else starts with the part of their email before the @. |

**Info items acted on**
- PostHog: README now says to turn on "Discard client IP data".
- Sign-in emails said codes last 1 hour; they last 15 minutes. Fixed.
- The export's formula guard now also covers values that start with spaces or a line break before `=`, `+`, `-` or `@`.

**Info items accepted for now** (none of these is exploitable in a way that matters before launch):
- The CSP has no `script-src`. Adding one needs nonces for Next.js inline scripts; revisit after launch.
- An export of more than 1000 gifts on one list would be cut at 1000. Free lists hold 5 people; noted for later.
- Someone who deletes their account and comes back must be re-linked by the owner.
- A time-zone change between daily runs can shift one reminder by a day.
- Guessing a 6-digit code is limited only by Supabase's per-address limits.
- Server actions without an `Origin` header are accepted (Next.js behavior; same-site cookies protect them).

**Checklist after the fixes:** all PASS (RLS, permission checks, secrets, webhook, paid status, invites, input validation, AI privacy, rate limits including email invites and the sign-in CAPTCHA, `npm audit --omit=dev` 0, hidden gifts, clickjacking and caching).

---

## Stage 9: Analytics and error tracking ✅ (Oct 7). Live data waits for PostHog + Sentry keys

**Done**
- **PostHog, product events (server-side, `src/lib/analytics-server.ts`):**
  - events: signed_up, person_added, gift_added, gift_status_changed, ideas_requested (with ok and plan), idea_saved, invite_created, family_joined, checkout_started, pass_activated, account_deleted;
  - sent after the response (never slows a page), keyed by the random account id only, with no names, emails or typed text.
- **PostHog, page views (browser, `src/lib/analytics.ts`):**
  - cookieless mode: no cookies, local or session storage, so no cookie banner is needed;
  - no autocapture, no session recordings, no extra scripts, and query strings and invite tokens are stripped from URLs;
  - loads only after the page is idle.
  - **Owner step:** turn on "Cookieless server hash mode" in the PostHog project settings, or browser page views are dropped.
- **Sentry:**
  - server errors via `src/instrumentation.ts` (`onRequestError`) and browser errors via `src/instrumentation-client.ts`;
  - every report is scrubbed (`src/lib/sentry-scrub.ts`): no cookies, headers, request bodies, query strings or invite tokens; the user is reduced to their id;
  - no performance tracing (stays within the free tier);
  - source-map upload is off (it needs a Sentry auth token; optional later).
- Each service does nothing until its key is set (`NEXT_PUBLIC_POSTHOG_KEY`/`_HOST`, `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`).

**Checks**
- Unit test: the error-report scrubbing.
- Browser tests, +2 × 2 (`tests/e2e/analytics.spec.ts`, with a local PostHog stand-in):
  - key steps are recorded by account id, the email, the person's name and gift titles never appear, and page views are path-only;
  - no analytics cookies or browser storage.
- Note: PostHog ignores automated browsers on purpose, so the test makes its browser look ordinary. Real visitors are unaffected.
- Full suite: 157 unit and database tests and 100 browser tests passing.

---

## Stage 8: Landing page, SEO, legal pages, PWA ✅ (Oct 7). Headline and legal wording need the owner

**Done**
- **Landing page (`/`):**
  - headline and subhead, with one "Start free" button;
  - "Sound familiar?" (Maria's 4 problems);
  - 3 benefits, each with a real screenshot of the app;
  - "How it works" in 3 steps;
  - pricing (Free vs Season Pass);
  - FAQ (6 questions);
  - a final sign-up button and the footer (Privacy, Terms, support email, "Not designed for children under 13").
- **Screenshots** (`public/screenshots/*.webp`) are made from the real app with sample data by `scripts/make-screenshots.mjs`. Re-run it after design changes.
- **SEO:**
  - meta title and description;
  - Open Graph and Twitter preview image (`src/app/opengraph-image.tsx`);
  - `sitemap.xml`;
  - `robots.txt`, which keeps `/app`, `/api`, `/join` and `/auth` out of search engines.
- **Legal:** plain-language drafts of the Privacy Policy and Terms (`src/app/privacy`, `src/app/terms`), linked in the footer and at sign-in. The Terms say the app isn't designed for children under 13 and you must be 13+.
- **Installable app (PWA):**
  - `manifest.webmanifest`: standalone, opens at `/app`, warm theme color;
  - app icon (gift box) at 192/512, plus a maskable version and an Apple touch icon, generated by `scripts/make-icons.mjs`;
  - Android builds its splash screen from the manifest colors and icon; iOS gets "Add to Home Screen" support via `appleWebApp`.
- **Dark mode pass:** dashboard, person, settings and upgrade pages checked by screenshot.
- **Small UI fix:** the idea card's category label moved next to the description, so the buttons don't wrap on phones.

**Checks**
- **Lighthouse (mobile, production build):** see the table below.
- **Browser tests:** +4 flows × 2 (`tests/e2e/site.spec.ts`):
  - every landing section, image alt text, and Start free → sign-in;
  - footer and sign-in links to the legal pages;
  - manifest, icons, robots, sitemap and the preview image;
  - security headers.

| Page | Performance | Accessibility | Best practices | SEO |
|---|---|---|---|---|
| `/` | 97 | 100 | 100 | 100 |
| `/sign-in` | 97 | 100 | 100 | 100 |
| `/privacy` | 98 | 100 | 100 | 100 |

**Waiting on the owner (§13)**
1. **Pick a headline.** It's currently option A:
   - **A.** "Stop overspending on holiday gifts." *(current)*
   - **B.** "Holiday gifts, on budget, with no doubles."
   - **C.** "Every gift. Every budget. One family list."
2. **Read the Privacy Policy and Terms.** Two items are marked **[owner to confirm]**: the refund policy (suggested: full refund within 14 days) and which US state's law applies.
3. **Support email:** set `NEXT_PUBLIC_SUPPORT_EMAIL` (shown in the footer and on the legal pages).

---

## Security review #1 (CLAUDE.md §15) ✅ fixed (Oct 7)

A separate review agent that didn't write the code checked every §15 item. It tested against the local stack with throwaway users and changed no files. Everything it found is fixed, and each fix has a regression test (`tests/db/security-review.test.ts`, plus unit tests). Migration: `20261014000000_security_review_1.sql`.

| # | Finding | Fix |
|---|---|---|
| H1 | Someone could pre-register another person's email with a password (Supabase's password sign-up is public) and log in after the real person confirmed it. | When an email is confirmed, any password on the account is replaced with a random one. "Confirm email" is on (locally too; must stay on in production). A test reenacts the full attack; I proved the test fails with the defense switched off. |
| H2 | Free accounts could run up AI costs: huge "interests" stored straight through the API, plus answers designed to fail so they don't count. | The database limits each interest to 30 characters. Every prompt field is trimmed before sending (a whole prompt stays under ~5,000 characters, even from 50 KB of stored text). A new cap of 30 AI attempts per person and 60 per list in any 24 hours, counting failures. Also: set a monthly spend limit in the Anthropic Console. |
| M1 | Open redirect: `/.//evil.com` turned into `//evil.com` after normalization. | The check runs on the normalized result, and only `/app…` and `/join…` are allowed. Bypass payloads added to the tests. |
| M2 | Sign-in codes were requested from our server, so Supabase's per-address limits would count *everyone* as one address (one abuser, or a busy launch day, could lock everyone out). | Code requests and checks now go straight from the person's browser. Codes expire after 15 minutes instead of 1 hour. Production rate limits and an optional CAPTCHA are on the production checklist. |
| L1 | Members could tell from a count that someone hidden from them is on the list. | `list_plan()` counts only the people the viewer can see (owners see all). |
| L2 | People could set an invite's expiry or creation date (bypassing the hourly limit), or fake a gift's activity line. | Insert permissions are limited to the columns people should set. Invites always start now and last 7 days. |
| L3 | A gift could be "hidden from" someone not on the list. | The database checks they're on the list. |
| L4 | A member could record someone else as the buyer. | Members can only record themselves; owners can record anyone on the list. The gift form only offers allowed choices. |
| L5 | Webhook order and edge cases: a refund arriving before the payment, a later payment event after a refund, test-mode or $0.01 events. | A refund-first is remembered and blocks the grant. A payment after a refund never re-grants. The event must match the key's live/test mode, be in USD, and be at least $9.99. |
| L6 | Database functions were runnable by anyone by default; new tables and functions would be open by default. | Execute revoked from the public role. Default privileges are closed, so anything new needs an explicit grant. A test lists every function anyone can run. |
| L7 | Earlier idea titles sent back from the browser weren't scrubbed; other people's names on the list weren't removed; "José" didn't match "Jose". | All three fixed, plus inputs are trimmed before scrubbing. That also removed a slow-regex risk found while testing. |
| L8 | No security headers. | Added: frame-ancestors none / X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, HSTS. |
| L9 | Deleting a user outside the app (e.g. the dashboard) left an orphaned list. | When an owner's membership disappears, the earliest member becomes owner, or the list is deleted if nobody is left. |

**Accepted (informational):**
- Someone who already knows a hidden item's internal id can tell from an error message that it exists. The ids are random and never shown to them.
- Login CSRF via email links is inherent to email sign-in.
- The AI usage count is shared by the whole list.

**Checklist after the fixes:** all PASS.
- Row-level security on every table, with second-user tests.
- Every action checks the user and their role.
- Secrets are server-only.
- The webhook verifies signatures and is idempotent.
- Paid status comes only from the database.
- Invites are random, expire, are single use, and only their hash is stored.
- All input is validated and nothing is rendered as raw HTML.
- No names or emails go to the AI.
- Rate limits on login, AI and invites.
- `npm audit --omit=dev`: 0 issues.

---

## Stage 7: Settings, export, account deletion ✅ (Oct 7)

**Done**
- **`/app/settings`:**
  - your name (what your family sees), time zone (common US zones first, plus "Use this device's time zone"), and return reminder emails on/off;
  - your plan;
  - Export my data;
  - Sign out (moved here from the header; the header now shows Family and Settings).
- **Export my data (`/api/export`):** a CSV of every person and gift you can see on every list you're on, on any plan. It runs with your own login, so hidden gifts never appear. Cells that spreadsheets would run as formulas are neutralized, and it opens correctly in Excel.
- **Delete my account:** type DELETE to confirm.
  - For each shared list you own, you choose who takes over (default: the first member). Lists only you use are deleted.
  - Your account, profile and memberships are removed. Gifts you added to other people's lists stay, without your name. Payment records stay, without your identity.
  - You're taken to `/goodbye`. Signing in again starts a fresh account.
- **Migration `20261013000000_stage7_account.sql`:** `transfer_list_ownership()`, server-only. It hands over only to a member, and only from the owner. The pass doesn't transfer.

**Checks:**
- Database tests +4: handing over a list, and deletion keeping payment records without the person.
- Unit tests +3: CSV quoting and formula blocking.
- Browser tests +5 flows × 2:
  - settings saved, and an empty name rejected;
  - the export includes your data and **not a gift hidden from you**;
  - signed-out visitors can't export;
  - deleting an account, and signing in again fresh;
  - an owner deleting their account hands the list to the chosen member, who gets owner controls.
- Full suite: 136 unit and database tests and 88 browser tests passing.

---

## Stage 6: Return reminders and emails ✅ (Oct 7). Real sending waits for Resend + domain

**Plan**
- A daily job at 9:00 AM Eastern (`vercel.json`, 14:00 UTC).
- The rules for who gets what, in the database (`20261012000000_stage6_reminders.sql`).
- One bundled email per person per day, safe to run twice.
- Signed one-click unsubscribe.
- The 4 email templates.
- A projected AI cost warning.
- **Risks:** duplicate emails, wrong-day emails across time zones, a hidden gift leaking into an email.

**Done**
- **`/api/cron/reminders`:** Vercel Cron calls it daily with `Authorization: Bearer CRON_SECRET`, checked with a constant-time comparison; anything else gets a 401.
- **`due_reminders()`:**
  - covers Bought or Wrapped gifts whose return-by date is exactly 3 days away or today, in each person's own time zone;
  - only on lists with a Season Pass;
  - goes to whoever marked the gift bought, or the owner;
  - never includes a gift hidden from that person or for the person linked to them;
  - skips people who turned reminders off.
- **One email per person per day:** `claim_reminder()` takes today's slot (`reminder_log`, keyed by person + local date) before sending. A second run skips anyone already emailed, and only a failed send can be retried. Resend also gets an idempotency key as a second guard.
- **Emails** (`src/lib/email/templates.ts`), plain layout with the app name in every subject and everything people typed escaped:
  - welcome (after onboarding or joining);
  - family invite (new "Or email an invite" box on the Family page; it creates a fresh single-use link);
  - Season Pass thank-you (sent from the webhook once per payment);
  - daily return reminder, with "Last day to return" and "Return window closes in 3 days" sections.
- **Unsubscribe:** every reminder has a signed unsubscribe link (HMAC with `UNSUBSCRIBE_SECRET`) and a `List-Unsubscribe` one-click header. The link opens a page with a button (so email scanners can't unsubscribe people by accident). A forged link does nothing.
- **AI cost warning:** the daily job projects this month's AI cost from logged tokens and emails `ADMIN_EMAIL` if it passes $50, at most once a day.
- **No keys = no crash:** without Resend keys, emails are skipped with a log line and the app works normally.

**Checks (all run, all passing)**
- Unit tests: +5 (escaping, subjects, receipt amount and date, reminder bundling, unsubscribe signatures).
- Database tests: +6 (`tests/db/reminders.test.ts`), run at a fixed moment (9 AM ET, Dec 20):
  - 3 days and day-of only, and only for Bought or Wrapped gifts;
  - goes to the buyer, and **never includes a gift hidden from them**;
  - New Zealand users get theirs by their own date;
  - a pass and reminders being on are both required;
  - people can't call these functions themselves;
  - claiming is once per day, with failed sends retryable.
- Browser tests: +4 flows × phone + desktop (`tests/e2e/emails.spec.ts`, using a local Resend stand-in that records emails):
  - welcome and thank-you emails;
  - the cron rejects a missing or wrong secret, sends one reminder, and **running it twice sends nothing extra**;
  - the unsubscribe link works and turns reminders off, and a forged link does nothing;
  - emailing an invite, and a bad address.

---

## Stage 5: Stripe payments and limits ✅ (Oct 7). Real test-card runs wait for Stripe keys

**Plan**
- Checkout session (one-time $9.99) and a success page that waits for the webhook.
- A webhook that verifies Stripe's signature and applies each event once.
- Payment and refund handling in the database (`20261011000000_stage5_payments.sql`).
- Security review #1 by a separate agent.
- **Risk:** granting a pass by mistake, or not granting it after payment. **Mitigation:** the webhook is the only thing that unlocks the pass; everything is tested with signed events.

**Done**
- **`/app/upgrade`:**
  - the price, what's included and "Upgrade for $9.99", which opens Stripe Checkout;
  - "You have the Season Pass through Jan 31, 2027" once paid;
  - "Checkout canceled. You weren't charged.";
  - stops selling after the season ends;
  - a note for members that a pass covers the lists you own.
- **`/app/upgrade/success`:** shows "Unlocking your Season Pass…" and checks the database every 1.5 seconds. It flips to "active" as soon as the webhook lands, and after about 30 seconds explains it may take a minute. The page itself unlocks nothing.
- **`/api/stripe/webhook`:**
  - verifies the `stripe-signature` with `STRIPE_WEBHOOK_SECRET`; anything unsigned or wrongly signed gets a 400;
  - `checkout.session.completed` and `async_payment_succeeded` grant the pass only for our own paid one-time checkouts, tagged with the user;
  - `charge.refunded`: a full refund removes the pass (unless another payment still covers it); a partial refund keeps it;
  - each Stripe event is applied once (the `stripe_events` table, inside one database transaction), so retries and duplicates are harmless.
- **Upgrade prompts:** the existing ones at 5 people, 1 member and 10 AI requests now lead here. Members who hit the AI limit on someone else's list are told to ask the owner.
- **Logic:** pure and tested in `src/lib/payments.ts` and `src/lib/season.ts`.

**Checks (all run, all passing)**
- Unit tests: +8 (Checkout parameters, how each webhook event is read, Season Pass dates in New York time).
- Database tests: +6 (`tests/db/payments.test.ts`):
  - people can't record payments themselves;
  - a payment grants the pass through Jan 31, 2027;
  - the same event twice adds one row;
  - partial vs. full refunds, and a second payment keeping the pass;
  - a deleted account's payment is still recorded;
  - the processed-events list is private.
- Browser tests: +5 flows × phone + desktop (`tests/e2e/payments.spec.ts`), sending events signed exactly as Stripe does:
  - unsigned or wrongly signed events are rejected;
  - **the success page alone unlocks nothing**;
  - the webhook unlocks the pass within seconds and the waiting page notices on its own;
  - a repeated event is harmless;
  - the limit is lifted and a 6th person can be added;
  - after a refund the limits return but all 6 people stay visible;
  - with no keys, "Checkout isn't switched on yet";
  - cancel shows "You weren't charged";
  - the owner's pass lifts the family limit.
- Full suite: type check, lint, 77 unit, 43 database and 70 browser tests passing.

---

## Stage 4: Family sharing ✅ (Oct 7)

**Done**
- **`/app/family`:**
  - who's on the list;
  - the owner can remove members (with an "are you sure?" step) and members can leave;
  - "Create invite link" with Copy and the phone's Share sheet; the link works once and lasts 7 days;
  - unused links can be cancelled;
  - the free plan shows "Your free plan includes 1 family member. Unlock unlimited family members for $9.99." after one member.
- **`/join/[token]`:**
  - signed out: "Sign in to join", and you come back to the invite after signing in;
  - signed in: "[Owner] invited you to join [list]", your name field, then Join;
  - expired, used, incomplete and unknown links each get a plain-language message;
  - joining switches you to that list and skips the new-list setup.
- **List switcher** in the header when you're on 2+ lists ("Holidays 2026 (mine)" / "Maria's Holidays 2026"). The choice is kept in a cookie and re-checked against your memberships every request.
- **Gift form "Hide this gift from":** checkboxes for everyone else on the list, owner included. The person page shows "Hidden from Alex" to people who can see the gift.
- **Linking a person:** the person form asks "Is this person on your family list?". Once linked, that member never sees the person, their gifts, their totals, or their pages (404).
- **Activity line:** "Marked bought by Alex, Nov 14" (and "Added by…"), shown on shared lists in the viewer's time zone.
- **Members:** can add gifts, edit and delete their own, one-tap status on anything they can see, and use Get ideas from the owner's pool. The owner-only controls (add/edit people, budget, invites) are hidden for them and blocked by the database.
- **Migration `20261010000000_stage4_sharing.sql`:**
  - invite fingerprints must be 64-character sha256;
  - at most 10 invites per person per hour, for every way of creating one;
  - `invite_preview()`;
  - a person can only be linked to, and a gift's buyer can only be, someone on the list.

**Checks (all run, all passing)**
- Database tests: +7 (`tests/db/sharing.test.ts`): invite preview, fingerprint format, 10-an-hour limit, linking and buyer limited to list members, members can hide their own gift from the owner but not others' gifts.
- Browser tests: +5 flows × phone + desktop (`tests/e2e/family.spec.ts`), with the owner and the member in separate browsers:
  - invite, join, the member marks a gift bought, the owner sees "Marked bought by…", the free member limit, and a link can't be used twice;
  - **a hidden gift never reaches the member**: not on the page, not in the page source, not in the totals, and its direct link returns 404;
  - linking a person hides them and their gifts (person page and ideas page return 404);
  - switching lists and leaving;
  - broken, unknown and signed-out links.
- Screens checked by screenshot (family page, join page, member view).

---

## Stage 3: AI gift ideas ✅ (Oct 7). Real-AI prompt test waits for the key

**Plan**
- Prompt, privacy scrubbing and answer checks as pure tested code (`src/lib/ai/ideas.ts`).
- The SDK call with a retry on malformed answers (`src/lib/ai/generate.ts`).
- Request limits in the database (`20261009000000_stage3_ai.sql`).
- Server actions (`src/app/app/ideas-actions.ts`) and the ideas screen.
- A local stand-in for the AI service for browser tests.
- **Risks:** can't call the real AI until the key arrives; leaking names; cost.

**Done**
- **"Get gift ideas"** on every person's page, and in onboarding step 3: sign-up → budget → first person → 5 ideas.
- **What's sent:** only age range, relationship, interests, notes, don't-buy notes and the remaining budget. The person's name and every list member's name are replaced with "[name]", and emails, phone numbers and links are stripped. The notes field asks people not to include names.
- **Model and format:** `claude-haiku-4-5`, server-side only, with output capped at 1,200 tokens. The answer is checked against a fixed format (Zod). The 5 ideas must:
  - be exactly 5;
  - be within the remaining budget;
  - avoid the don't-buy list (singular forms too);
  - contain no links.

  If the answer breaks any of these, it asks once more; if it fails again, the request is free. Prompts and answers are never logged.
- **Follow-ups:** "More like this" and "Different direction" each count as one request. "Save as gift idea" adds it as an Idea with the estimated price and the reason in its notes.
- **No budget yet:** you're asked first ($25 / $50 / $100 / other). Owners save it on the person; members use it just for that request. A budget that's used up gets a friendly message and uses no request.
- **Limits (enforced in the database, reserved by the server before calling the AI):**
  - 10 successful requests per free list, 100 with a pass, shared by the family;
  - 10 requests a minute per person;
  - failed, slow or malformed answers don't count;
  - the limit message offers the Season Pass.
- **Timeouts:** one overall deadline per request (25 seconds) plus the SDK's single network retry. The ideas pages allow up to 60 seconds on Vercel.
- **Cost logging:** tokens are logged per request and per user in `ai_requests`.

**Checks (all run, all passing)**
- Unit tests: +12 (name and email scrubbing, prompt contents, budget and don't-buy checks, link blocking, rounding).
- Database tests: +7 (people can't reserve or finish requests themselves, only list members can use requests, failures are free, the family shares 10, finishing is one-time, the pass raises the cap to 100, 10 a minute).
- Browser tests: +9 flows × phone + desktop, all against the AI stand-in (`tests/fake-ai/server.mjs`, which speaks the real API format):
  - first idea during onboarding in under 2 minutes (it takes about 2 seconds);
  - the request actually sent contains no names, uses the right model and the token cap;
  - follow-ups;
  - the budget question;
  - server errors, slow answers, and malformed answers (retried once), with no request used on failure;
  - the free cap reached, and the budget reached.

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
- **Test users sign in without passwords** (an admin-generated one-time link), the same way people do. Passwords are scrambled on confirmation anyway.
- **Native pickers on phones:** relationship, age range and status use the phone's own picker (fast and familiar) instead of a custom dropdown.
- **Money input** accepts "25", "24.99", "$1,299.99" and is stored as whole cents.
- **Gift edits by members:** members can edit and delete only gifts they added. Status can be changed by anyone who can see the gift.
- **AI request pool is per list:** it belongs to the list owner's plan, as agreed. Members using "Get ideas" draw from the same pool.
- **AI stand-in for tests only:** browser tests point the real SDK at `tests/fake-ai/server.mjs` through `ANTHROPIC_BASE_URL`. The app itself has no test-only code paths.
- **`npm test`** runs unit and database tests. `npm run test:ai-live` is separate because it costs real money.
- **Invites are shared by link, not email, for now.** Maria texts it to her mom. The "family invite" email template comes with the other emails in Stage 6.
- **Joiners choose the name** their family sees. Owners will edit theirs in Settings (Stage 7); until then it's the start of their email address.
- **Linking yourself as a person:** the owner can no longer read that row back after linking (by design), so the app must not ask for the row back after saving that link.

## Production setup checklist (Supabase dashboard; needed before launch)
Full click-by-click steps are in README → "Putting it online".
- **Auth → Providers → Email:**
  - "Confirm email" ON (required by security fix H1);
  - "Secure password change" ON (review #2 M1);
  - OTP expiry 900 seconds; leave the password minimum strong.
- **Auth → Rate limits:** Supabase's per-IP limits (sign-in attempts, code checks) apply per visitor now that sign-in runs in the browser. But the **email limit is one shared budget for the whole project**: raise "emails sent per hour" to at least 200 for launch week.
- **Auth → Attack Protection → CAPTCHA: required.** Turnstile, with the secret key in Supabase and `NEXT_PUBLIC_TURNSTILE_SITE_KEY` in Vercel, both switched on together (review #2 M5).
- **Auth → SMTP:** use Resend.
- **Email templates:**
  - `sign-in.html` for "Magic Link" and "Confirm signup";
  - `email-change.html` for "Change Email Address";
  - `password-reset.html` for "Reset Password".
- **URL configuration:** Site URL = production URL; redirect URLs = production URL + `/**`.
- **Database:** apply `supabase/migrations/*` in order (`supabase db push`).
- **Anthropic Console:** set a monthly spend limit (e.g. $50).
- **PostHog:** Project settings → turn on cookieless server hash mode and "Discard client IP data".

## Known issues
- **Real email not sent yet:** needs the Resend account, the API key and a verified sending domain (which needs the domain bought). Before launch, in the Supabase dashboard:
  - turn on custom SMTP using Resend;
  - paste `supabase/templates/sign-in.html` into both the "Magic Link" and "Confirm signup" templates, with subject `Your GiftLedger sign-in code: {{ .Token }}`;
  - set the Site URL and redirect URLs.
- **Stripe not exercised for real yet:** needs the test keys, a price ID and the allowed domains. Then:
  1. Run the Stripe CLI `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
  2. Pay with test cards 4242 4242 4242 4242 (success) and 4000 0000 0000 0002 (declined), and confirm the pass unlocks and a decline shows Stripe's message.
- **Stripe Tax is off** until the owner decides about sales tax.
- **Real AI not tested yet:** needs the Anthropic key. Once `APP_ANTHROPIC_API_KEY` is in the cloud environment, run `npm run env:local && npm run test:ai-live`. That's 10 sample profiles at about 5 cents in total; it checks every answer and prints the ideas for review. Structured output for `claude-haiku-4-5` is assumed to work; if the API rejects it, the fallback is to drop `output_config` (the Zod check stays).
- `npm audit` reports 5 "high" issues, all in development-only lint tooling (`braces`, used by `eslint-config-next`), with no fixed version yet. `npm audit --omit=dev` (what ships to users) reports 0. Re-check before launch.
- Terms and Privacy pages are drafts: the owner (ideally with a lawyer) must review them before launch.
- **CAPTCHA not tested against Cloudflare itself:** the browser tests use a stand-in for Turnstile's script. After the site key and secret are set, sign in once on the live site to confirm it.

## Next step
All 10 stages are built and tested locally. Next, in order:
1. **GitHub access** (owner): reconnect GitHub so the local commits can be pushed. Nothing is online until then.
2. **Keys and accounts** (owner, table at the top): Stripe test keys, the Anthropic key, Supabase and Vercel projects, Resend, PostHog, Sentry, and Cloudflare Turnstile. As each arrives, Claude runs its live check: `npm run test:ai-live`, the Stripe test-card run (`STRIPE_LIVE_TEST=1`), and a real sign-in email.
3. **Decisions** (owner): the headline (A/B/C), the legal review (refund policy, governing state), and the support email.
4. **Buffer days** (Nov 5–9): fix anything the live checks find. Run the full suite again. Go live (owner switches Stripe to live mode).
