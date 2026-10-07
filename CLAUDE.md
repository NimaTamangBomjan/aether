# GiftLedger: project brief for Claude Code

Read this file at the start of every session. It is the source of truth for this project. If something I say in chat conflicts with this file, ask me which one wins, then update this file.

Also read `PROGRESS.md` (current stage, decisions, known issues) and `AGENTS.md` (notes on this Next.js version) at the start of every session. Section 21 records decisions approved at kickoff; where it is more specific than earlier sections, section 21 wins.

## 1. The product in one sentence
GiftLedger is a mobile-friendly web app that helps families plan holiday gifts: a budget per person, AI gift ideas, a shared family list so nobody buys duplicates, and reminders before return windows close.

## 2. Goal and deadline
- **Launch date: November 10, 2026** (live, taking real payments). Black Friday is Nov 27; most sales will come Nov 10 – Dec 24.
- **Success target for the season:** 1,000 sign-ups, 100 paid Season Passes.
- Shipping on time matters more than extra features. If a feature threatens the date, tell me and suggest cutting it.

## 3. Who it's for
**Primary user: "Maria," 38, a parent buying for 15–25 people** (kids, parents, in-laws, teachers, coworkers). She plans on her phone in short bursts, often in a store or in bed. She isn't technical and won't read instructions.

Her problems:
1. She goes over budget because she can't see the total.
2. She and her partner (or her mom) buy the same gift.
3. She runs out of ideas for hard-to-buy-for people.
4. She misses return deadlines.

**Design test for every screen:** can Maria do this one-handed on a phone in under 30 seconds without help?

## 4. Business model
- **Free:** up to 5 recipients, 10 AI idea requests, one family member invite.
- **Season Pass, $9.99 one-time (Stripe Checkout):** unlimited recipients, 100 AI idea requests, unlimited family members, return reminders. Valid through **Jan 31, 2027**.
- Show limits clearly with friendly upgrade prompts at the moment of need ("You've added 5 people. Unlock unlimited for $9.99"). Never block someone from viewing or exporting their own data.
- Refunds handled manually by me through the Stripe dashboard; the webhook must handle `charge.refunded` and remove paid access.

## 5. Tech stack (do not change without asking)
| Need | Tool |
|---|---|
| Framework | Next.js (App Router), TypeScript (strict), Tailwind CSS |
| UI components | shadcn/ui |
| Database + auth | Supabase (Postgres, row-level security, magic-link email + Google sign-in) |
| Payments | Stripe Checkout (one-time payment) + webhook |
| AI | Anthropic API, model `claude-haiku-4-5`, server-side only |
| Email | Resend (magic links via Supabase SMTP if possible, reminders via Resend) |
| Scheduled jobs | Vercel Cron, once daily at 9:00 AM ET |
| Analytics | PostHog (free tier), cookieless if possible |
| Errors | Sentry (free tier) |
| Hosting | Vercel |
| Tests | Vitest (logic), Playwright (main user flows) |

Use the simplest working approach. No extra libraries without a reason I'd understand.

## 6. Features and acceptance criteria
Each feature is done only when every check passes.

### 6.1 Sign up and onboarding
- Sign up with email magic link or Google.
- First-run onboarding in 3 steps max: set an overall holiday budget (optional) → add your first person → see an AI idea for them.
- ✅ A new user reaches their first AI idea in under 2 minutes.

### 6.2 Dashboard
- Total budget, total spent, amount left, and a progress bar per person.
- People sorted by "still needs a gift" first.
- Colors: green under budget, amber within 10%, red over.
- ✅ Totals update immediately when a gift's price or status changes.

### 6.3 Recipients
- Fields: name, relationship (dropdown + custom), budget, age range, interests (tags), notes, "already has / don't buy" notes.
- Add, edit, delete (with confirmation), and archive.
- ✅ Free users are blocked at the 6th recipient on the server, not just in the UI.

### 6.4 Gifts
- Fields: title, link (optional), price, quantity, status (Idea → Bought → Wrapped → Given), store, purchase date, return-by date, notes, "bought by" (family member).
- Quick-add from a recipient's page; change status with one tap.
- If a store is entered and the return-by date is empty, suggest a default 30 days after purchase that the user can edit.
- ✅ Spent totals count only Bought, Wrapped and Given gifts.

### 6.5 AI gift ideas
- Button on each recipient: "Get ideas."
- Send only: age range, relationship, interests, notes, "don't buy" notes, remaining budget. **Never send names, emails or other users' data.**
- Return exactly 5 ideas as structured JSON (validate with Zod; retry once if invalid): `{ title, estimated_price_usd, why_it_fits, category }`.
- Ideas stay within the remaining budget and avoid the "don't buy" list.
- "More like this" and "Different direction" buttons for follow-ups (each counts as one request).
- One-tap "Save as gift idea."
- No product links or invented store names in AI output.
- Rate limit: 10 requests per minute per user; enforce free and paid caps on the server.
- ✅ A failed or slow AI call shows a friendly message and doesn't use up a request.

### 6.6 Family sharing
- The list owner creates an invite link (expires in 7 days). Invitees sign in and join.
- Roles: **Owner** (everything) and **Member** (view, add gifts, mark "bought by me").
- Per-gift "Hide from" setting, so a family member who is also a recipient can't see their own gifts.
- Activity line on each gift: "Marked bought by Alex, Nov 14."
- ✅ Tested: a hidden gift never shows up for that member in any page, API response or email.

### 6.7 Return reminders (paid)
- Email 3 days before and on the morning of each return-by date, only for gifts in Bought or Wrapped status.
- One email per user per day bundling all reminders. Unsubscribe link in every email.
- Dates stored and shown in the user's time zone (detect in the browser, editable in settings).
- ✅ The cron job is idempotent: running it twice the same day sends nothing extra.

### 6.8 Payments
- Upgrade button → Stripe Checkout → success page → paid features unlock within seconds.
- The webhook is the source of truth (verify the signature); the success page alone never unlocks access.
- Handle `checkout.session.completed` and `charge.refunded`.
- Stripe test mode in development, live mode in production via environment variables.
- ✅ Tested with Stripe test cards, including a declined card.

### 6.9 Settings and account
- Edit name, time zone and email preferences.
- **Export my data** (CSV of recipients and gifts).
- **Delete my account** (removes all personal data; shared lists pass to another member or are deleted).

### 6.10 Landing page and SEO
- Sections: headline, problem, 3 benefits with screenshots, how it works (3 steps), pricing, FAQ, final sign-up button.
- Headline direction: "Stop overspending on holiday gifts." Write 3 headline options for me to choose from.
- Meta title and description, Open Graph image, sitemap, robots.txt.
- Page speed: Lighthouse 90+ on mobile.

### 6.11 Legal and trust
- Privacy Policy and Terms in plain language (templates I'll review before launch), linked in the footer and at sign-up.
- Cookie use kept minimal; if analytics needs cookies, show a simple notice.
- Contact email in the footer.
- Must not be designed for children under 13, and must say so in the Terms.

## 7. Out of scope (do not build)
- Automatic price tracking or scraping retailer websites
- Native iOS or Android apps (a PWA is enough)
- Affiliate links, subscriptions, multiple currencies or languages
- Secret Santa or gift-exchange draws
- Admin dashboard (I'll use the Supabase and Stripe dashboards)

## 8. Design direction
- Warm, cheerful and calm: festive accents, not a Christmas-card overload. Works for anyone celebrating a gift-giving holiday.
- Mobile-first, designed for 375px wide first; large tap targets (44px+).
- Accessible: proper contrast, labels on every input, keyboard navigable.
- Installable PWA with an app icon and splash screen.
- Light and dark mode.

## 9. Security and cost guardrails
- Row-level security on every table, with tests proving one user can't read another's data.
- All secrets in environment variables; provide `.env.example` with every key documented.
- Validate every input on the server (Zod).
- Cap AI spending: limit tokens per request and log usage per user. Warn me if projected cost passes $50/month.
- Never log personal details or full AI prompts in production.

## 10. How we work together
1. **Plan once, then keep going.** After I approve the kickoff plan, work through the stages in section 11 without waiting for my OK between them. At the start of each stage, write a short plan in `PROGRESS.md` (files, database changes, risks). Stop and ask only for the reasons in section 13.
2. **Small stages, each one working.** Run the app and the tests after every stage, and tell me in plain language what works and what doesn't.
3. **Git:** commit after each working step with a clear message. Never commit secrets.
4. **Ask, don't guess,** whenever you need an account, an API key, a product decision or a design choice. Give me options with your recommendation.
5. **Explain simply.** I'm still learning. When I need to do something myself (create an account, paste a key, click in a dashboard), give step-by-step instructions.
6. **Keep this file updated** when we make a decision, and keep a `PROGRESS.md` log of what's done and what's next.
7. Don't stop to ask about small things you can reasonably decide; note them in `PROGRESS.md` instead.

## 11. Build order
1. Project setup, Supabase schema, auth, row-level security and tests
2. Recipients, gifts and the dashboard
3. AI gift ideas
4. Family sharing
5. Stripe payments and limits
6. Return reminders (cron + email)
7. Settings, export, account deletion
8. Landing page, SEO, legal pages, PWA
9. Analytics and error tracking
10. Full end-to-end test, launch checklist, deploy to production

## 12. Definition of done (launch checklist)
- [ ] All acceptance criteria above pass
- [ ] Playwright test passes: sign up → add person → AI ideas → save gift → invite family member → upgrade with test card → reminder email sent
- [ ] Stripe switched to live mode and one real $9.99 purchase tested and refunded
- [ ] Custom domain connected with HTTPS; email sending domain verified (SPF/DKIM) so emails don't land in spam
- [ ] Privacy Policy and Terms reviewed by me
- [ ] Sentry and PostHog receiving data
- [ ] `README.md` explains setup, deploying, and where every key lives, in plain language

## 13. Working on your own: when to stop and ask
Keep building without checking in, **except** in these cases, where you must stop and ask me:
1. You need an account, API key, password or anything from a dashboard only I can access.
2. Anything that spends real money or touches live customers: switching Stripe to live mode, buying a domain, raising a paid plan.
3. Deleting or overwriting data, a database reset, or a migration that drops columns or tables.
4. Final wording of the Privacy Policy, Terms, prices or the landing page headline.
5. Changing the tech stack, the pricing or anything in section 7 (out of scope).
6. You've tried **two different approaches** to a problem and it still fails.

For everything else, make the reasonable choice, write it under "Decisions" in `PROGRESS.md`, and continue.

When you stop, ask in one message: what you need, why, and step-by-step instructions for me. Then continue with any other work that doesn't depend on the answer.

## 14. Check your own work after every stage
A stage is done only when all of these pass. Run them; don't assume.
1. `npm run typecheck`, `npm run lint` and `npm run build` pass with no errors.
2. Unit tests (Vitest) pass for all logic: budgets, totals, limits, dates, time zones.
3. Playwright tests pass for the flows built so far, at **375px (phone)** and **1280px (desktop)** widths.
4. Start the app, go through each new screen in a browser, and check the browser console for errors and warnings.
5. Test the unhappy paths: empty states, wrong input, network or AI failures, a logged-out user opening a private page, a second user trying to access the first user's data.
6. Update `PROGRESS.md` (done, decisions, known issues, next step) and commit.

**Never** fake a pass: don't skip, delete or weaken tests, mock away the thing being tested, turn off row-level security, or use `any` / `@ts-ignore` to silence errors. If something truly can't pass yet, write it down in `PROGRESS.md` under "Known issues" and tell me.

## 15. Security review before payments and again before launch
Check every item and record the result in `PROGRESS.md`:
- [ ] Every table has row-level security, with tests for a second user being blocked.
- [ ] Every API route and server action checks the logged-in user and their permission.
- [ ] The Supabase **service role key** and all other secret keys are only used on the server; only `NEXT_PUBLIC_` variables reach the browser, and none of them are secret.
- [ ] The Stripe webhook verifies the signature and handles the same event twice safely.
- [ ] Paid status is read from the database, never trusted from the browser.
- [ ] Invite links are random, expire, and can't be reused after someone joins.
- [ ] All user input is validated on the server; nothing user-written is rendered as raw HTML.
- [ ] AI requests contain no names, emails or other users' data.
- [ ] Rate limits on login, AI and invite endpoints.
- [ ] `npm audit` shows no high or critical issues.

Use a separate review agent for this (one that didn't write the code) when available, and fix everything it finds.

## 16. Picking up where you left off
Sessions will end and context will run out. To keep going smoothly:
- Start every session by reading `CLAUDE.md` and `PROGRESS.md`.
- Keep `PROGRESS.md` current enough that a fresh session can continue with no other information: current stage, what's done, what's next, decisions, known issues and blockers.
- Commit often so nothing is lost.

## 17. Starting data model (adjust if needed, and explain why)
- `profiles`: user id, display name, time zone, email preferences, `is_paid`, `paid_until`
- `lists`: id, owner, name (e.g. "Holidays 2026"), overall budget
- `list_members`: list, user, role (owner / member), joined at
- `invites`: list, token (random), created by, expires at, used at
- `recipients`: list, name, relationship, budget, age range, interests, notes, don't-buy notes, archived
- `gifts`: recipient, title, link, price, quantity, status, store, purchase date, return-by date, notes, bought by, created by
- `gift_hidden_from`: gift, user
- `ai_requests`: user, recipient, created at, tokens used, success
- `payments`: user, Stripe session id, amount, status, refunded at
- `reminder_log`: user, date sent, gift ids (prevents duplicate emails)

Money is stored in cents as whole numbers, never as decimals.

The implemented schema (with the approved changes: no `is_paid`, owner stored as a `list_members` role, `linked_user_id` on recipients, hashed invite tokens, `stripe_events`, a status on `reminder_log`, and `invite_emails` (one-way fingerprints of emailed invite addresses, for anti-spam limits)) lives in `supabase/migrations/`.

## 18. Environment variables
Document each one in `.env.example` with where to find it:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `SENTRY_DSN`, `NEXT_PUBLIC_APP_URL`.

## 19. Writing and tone (app text, emails, errors)
- Friendly, short, plain English. No jargon.
- Error messages say what happened and what to do next ("Couldn't load ideas. Try again in a moment. This didn't use up a request.").
- Emails: one clear purpose each, plain layout, the app name in the subject. Templates needed: welcome, family invite, payment receipt/thank you, daily return reminder.

### Starting system prompt for AI gift ideas (improve it and test it with 10 sample profiles)
"You suggest thoughtful, realistic gifts. Given a recipient's age range, relationship to the giver, interests, notes, things not to buy, and a remaining budget in US dollars, suggest exactly 5 gifts. Each must fit within the budget, avoid everything on the don't-buy list, and be something commonly sold in the US. Mix price points and types (an item, an experience, something personal). Don't name specific stores or invent product links. Return only JSON matching the given schema."

## 20. After launch
- A small "Send feedback" link that emails me.
- Daily Supabase backups turned on.
- Sentry alerts sent to my email.
- A simple `LAUNCH.md` with the posts and channels for launch week (TikTok/Reels ideas, parenting groups, Reddit where self-promotion is allowed).

## 21. Decisions approved at kickoff (Oct 7, 2026)
**Purchases:** the owner does every purchase and card entry personally, later: Vercel Pro, Supabase Pro, Resend Pro, the domain, Anthropic credits, Stripe live mode. Claude never buys anything or enters payment details, and builds everything else without waiting for them.

**Environment and workflow**
1. Development happens in a Claude Code cloud container that is wiped when idle: commit and push after every working step. Keys live in the cloud environment's settings (environment variables), never in chat or GitHub. Environment changes only apply to new sessions.
2. Development and tests use a local Supabase in Docker (`npm run db:start`, images from Docker Hub). The container's network blocks Stripe, Supabase cloud, Resend, PostHog and Sentry until the owner allows those domains.
3. In the cloud environment the Anthropic key is stored as `APP_ANTHROPIC_API_KEY` (so Claude Code never uses it); `npm run env:local` maps it to `ANTHROPIC_API_KEY`. Vercel uses the normal name.
4. Work happens on the assigned `claude/...` branch; each finished, checked stage is also pushed to `main`.
5. The name and domain are not final yet ("GiftLedger" is the working name).

**Costs (owner decides and pays later):** Vercel Pro ($20/mo, required for commercial use), Supabase Pro ($25/mo, for restorable daily backups), Resend Pro ($20/mo, the free plan's 100 emails/day is too low for launch). Supabase must send sign-in emails through Resend SMTP (the built-in sender is for testing only). Sales tax / Stripe Tax: owner to decide with an accountant.

**Product rules**
6. The list owner's plan applies to the whole list: if the owner has a Season Pass, everyone on the list gets unlimited people and members, and AI ideas on that list use the owner's 100.
7. Each account owns exactly one list (created automatically at sign-up) and can be a member of other lists.
8. "Hide from" applies to owners too. A person on the list can be linked to a family member; that member never sees the person, their gifts or their totals. Totals are always computed from the gifts the viewer can see.
9. Members: add gifts, edit/delete gifts they added, change status on any gift they can see (marking Bought records them as buyer), use Get ideas. They cannot add/edit people, invite, or change budgets.
10. Free plan: 1 member besides the owner (checked when someone joins; invite links are single use). Archived people count toward the 5. Only successful AI requests count. Limits last the whole season.
11. Return reminders go to the person who marked the gift Bought, otherwise the owner; only for lists with a pass, and only if they have not unsubscribed.
12. Return-by is a calendar date. A person's time zone only decides what "today" is. The reminder job runs daily at 9:00 AM Eastern (14:00 UTC in winter).
13. When the pass ends (Jan 31, 2027) or is fully refunded, nothing is deleted or hidden; only adding beyond free limits, adding members, and reminders stop. A partial refund keeps the pass.
14. Sign-in emails contain both a link (works in any browser) and a 6-digit code.
15. Before sending notes to the AI, the person's name and the list members' names are replaced with "[name]"; a hint under the notes field asks people not to include names. The Privacy Policy says notes are sent to an AI provider.
16. Budget math: total budget = overall budget if set, otherwise the sum of per-person budgets. Spent = price × quantity for Bought, Wrapped and Given. Amber = 90–100% used; people without a budget show grey. Get ideas for someone without a budget first asks for one ($25 / $50 / $100 / other).
17. Account deletion: the owner picks who takes over a shared list (default: earliest member); with no members the list is deleted. The Season Pass does not transfer. Payment records are kept without the person's identity.
18. Google sign-in is added once the owner has set up Google Cloud; email link + code ships first.

**Cut list if behind schedule** (in order): "More like this / Different direction", the activity line, the PWA splash screen and dark-mode polish. Never cut: security rules and hidden-gift tests, webhook correctness, the database block on a 6th person, safe-to-repeat reminders.

