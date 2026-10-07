# GiftLedger progress log

Read this with `CLAUDE.md` at the start of every session. Newest stage first.

## Where we are
- **Current stage:** 6: Return reminders (in progress). Security review #1 running
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
- **Tests sign in test users with passwords created through the admin API.** The app itself never shows a password option.
- **Native pickers on phones:** relationship, age range and status use the phone's own picker (fast and familiar) instead of a custom dropdown.
- **Money input** accepts "25", "24.99", "$1,299.99" and is stored as whole cents.
- **Gift edits by members:** members can edit and delete only gifts they added. Status can be changed by anyone who can see the gift.
- **AI request pool is per list:** it belongs to the list owner's plan, as agreed. Members using "Get ideas" draw from the same pool.
- **AI stand-in for tests only:** browser tests point the real SDK at `tests/fake-ai/server.mjs` through `ANTHROPIC_BASE_URL`. The app itself has no test-only code paths.
- **`npm test`** runs unit and database tests. `npm run test:ai-live` is separate because it costs real money.
- **Invites are shared by link, not email, for now.** Maria texts it to her mom. The "family invite" email template comes with the other emails in Stage 6.
- **Joiners choose the name** their family sees. Owners will edit theirs in Settings (Stage 7); until then it's the start of their email address.
- **Linking yourself as a person:** the owner can no longer read that row back after linking (by design), so the app must not ask for the row back after saving that link.

## Known issues
- **Stripe not exercised for real yet:** needs the test keys, a price ID and the allowed domains. Then:
  1. Run the Stripe CLI `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
  2. Pay with test cards 4242 4242 4242 4242 (success) and 4000 0000 0000 0002 (declined), and confirm the pass unlocks and a decline shows Stripe's message.
- **Stripe Tax is off** until the owner decides about sales tax.
- **Real AI not tested yet:** needs the Anthropic key. Once `APP_ANTHROPIC_API_KEY` is in the cloud environment, run `npm run env:local && npm run test:ai-live`. That's 10 sample profiles at about 5 cents in total; it checks every answer and prints the ideas for review. Structured output for `claude-haiku-4-5` is assumed to work; if the API rejects it, the fallback is to drop `output_config` (the Zod check stays).
- **AI cost warning:** the "projected cost over $50/month" alert will be added to the daily cron in Stage 6. Usage is already logged per request.
- `npm audit` reports 5 "high" issues, all in development-only lint tooling (`braces`, used by `eslint-config-next`), with no fixed version yet. `npm audit --omit=dev` (what ships to users) reports 0. Re-check before launch.
- Terms and Privacy pages are placeholders until Stage 8.
- Production Supabase needs the sign-in email template pasted into its dashboard (Stage 6 checklist).

## Next step
Stage 5, payments:
- Stripe Checkout (one-time $9.99, Season Pass through Jan 31, 2027);
- the success page waits for the webhook;
- the webhook (signature check, safe to repeat), handling `checkout.session.completed` and `charge.refunded`;
- upgrade prompts lead to Checkout;
- security review #1 by a separate review agent.

Stripe can't be reached from the container until its domains are allowed and test keys are added, so the webhook logic is tested with locally signed events. Real test-card runs wait for the keys.
