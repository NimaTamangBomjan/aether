# GiftLedger

A phone-friendly holiday gift planner:
- a budget for every person, with live totals;
- AI gift ideas;
- a shared family list so nobody buys the same gift twice;
- reminders before return windows close.

- **The brief and every decision:** [`CLAUDE.md`](CLAUDE.md)
- **What's done, what's next, known issues:** [`PROGRESS.md`](PROGRESS.md)
- **Every setting, explained:** [`.env.example`](.env.example)

---

## How it's built

| Part | Tool | Where it lives |
|---|---|---|
| Website and app | Next.js 16 (App Router), TypeScript, Tailwind, shadcn/ui | `src/` |
| Database and sign-in | Supabase (Postgres with row-level security) | `supabase/migrations/` |
| Payments | Stripe Checkout + webhook | `src/app/app/upgrade/`, `src/app/api/stripe/webhook/` |
| AI gift ideas | Anthropic API, `claude-haiku-4-5` | `src/lib/ai/` |
| Emails | Resend (and Supabase sign-in emails through Resend) | `src/lib/email/`, `supabase/templates/` |
| Daily job: reminders and tidy-up | Vercel Cron, 9:00 AM Eastern | `vercel.json`, `src/app/api/cron/reminders/` |
| Analytics | PostHog, cookieless | `src/lib/analytics*.ts` |
| Errors | Sentry | `src/instrumentation*.ts` |
| Hosting | Vercel | |
| Tests | Vitest (logic + database security), Playwright (phone + desktop) | `src/**/*.test.ts`, `tests/` |

**Security, in short:**
- Every table has row-level security, so the database itself checks who can see and change what.
- All secrets stay on the server.
- The Stripe webhook is the only thing that unlocks the Season Pass.
- Nothing that identifies people is sent to the AI, analytics or error reports.

Both security reviews are in `PROGRESS.md`.

---

## Run it on a computer (developers)

You need **Node.js 22** and **Docker**.

```bash
npm install
npm run db:start      # starts a private copy of the database and sign-in service in Docker
npm run env:local     # writes .env.local with the local keys
npm run dev           # open http://localhost:3000
```

Sign-in emails sent locally don't go out. Read them in the local inbox at http://127.0.0.1:54324.

**Checks** (run them all before every release):
```bash
npm run check         # type check, lint, unit + database security tests, production build
npm run test:e2e      # browser tests at phone (375px) and desktop (1280px) sizes
npm run test:ai-live  # the real AI on 10 sample people (needs ANTHROPIC_API_KEY, costs ~5 cents)
```

The browser tests use local stand-ins for the AI, email, Stripe's webhook and analytics. Nothing real is called, and nobody is charged.

---

## Putting it online (step by step)

Do these in order. Each step says where to click. Never paste keys into chat or GitHub: they go into Vercel's settings (step 2).

### 1. Supabase (database and sign-in)
1. Go to supabase.com → **New project**. Pick the region **US East**, and save the database password in your password manager.
2. **Apply the database setup.** On a computer with this code, run:
   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR-PROJECT-REF
   npx supabase db push
   ```
   The project ref is in the project URL. This creates all the tables and security rules.
3. **Authentication → Sign In / Providers → Email:**
   - **Confirm email: ON.** This is required for security.
   - **Email OTP Expiration: 900** (seconds).
4. **Authentication → Emails → SMTP Settings:** turn on custom SMTP using Resend (step 5): host `smtp.resend.com`, port `465`, user `resend`, password = your Resend API key, sender = your `EMAIL_FROM` address.
5. **Authentication → Emails → Templates:**
   - **Magic Link** and **Confirm signup:** subject `Your GiftLedger sign-in code: {{ .Token }}`, body = the contents of `supabase/templates/sign-in.html`.
   - **Change Email Address:** subject `GiftLedger: no change was made`, body = `supabase/templates/email-change.html`.
   - **Reset Password:** subject `GiftLedger doesn't use passwords`, body = `supabase/templates/password-reset.html`.

   GiftLedger has no passwords and refuses email changes, but Supabase sends those two emails before it checks. These versions contain no links, so nobody can use them for phishing.
6. **Authentication → URL Configuration:**
   - Site URL: `https://YOUR-DOMAIN`
   - Redirect URLs: `https://YOUR-DOMAIN/**` (add your Vercel preview URL too, if you use previews)
7. **Authentication → Sign In / Providers → Email:** turn on **Secure password change**. (There are no passwords; this is an extra lock.)
8. **Authentication → Rate Limits:** the email limit is **one shared budget for the whole app**, not per visitor. Every sign-in code counts against it. Set "emails sent per hour" to at least **200** for launch week (Resend's free plan allows 100 a day, so check your Resend plan too).
9. **Authentication → Attack Protection → CAPTCHA** (free, stops someone using up that email budget):
   1. At dash.cloudflare.com → **Turnstile → Add widget**: add your domain, widget mode **Managed**. Copy the **Site Key** and **Secret Key**.
   2. In Supabase: turn CAPTCHA on, provider **Turnstile**, paste the **Secret Key**.
   3. In Vercel: set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` to the **Site Key** and redeploy.

   Do steps 2 and 3 together: with only one of them, sign-in stops working.
10. **Project Settings → API:** you'll copy the URL, the anon key and the service_role key into Vercel in the next step.
11. *(Recommended, paid)* Upgrade to Pro for daily backups you can restore.

### 2. Vercel (hosting)
1. Go to vercel.com → **Add New → Project** → import this GitHub repository.
2. **Settings → Environment Variables:** add every variable from the table below.
3. Deploy. The daily reminder job in `vercel.json` sets itself up.
4. **Settings → Domains:** add your domain and follow Vercel's DNS instructions.
5. A paid app needs Vercel **Pro** ($20/month) under Vercel's terms.

### 3. Stripe (payments)
1. **Product catalog → Add product:** "Season Pass", **one-time** price **$9.99 USD**. Copy the price ID (`price_…`).
2. **Developers → API keys:** copy the secret key (`sk_test_…` while testing) and the publishable key (`pk_test_…`).
3. **Developers → Webhooks → Add endpoint:**
   - URL: `https://YOUR-DOMAIN/api/stripe/webhook`
   - events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`
   - copy the signing secret (`whsec_…`).
4. **Test it:** buy with card `4242 4242 4242 4242` (any future date, any CVC). The Season Pass should unlock within seconds. Card `4000 0000 0000 0002` should be declined with a clear message.
5. **Going live** (do this together with Claude):
   - switch the Stripe dashboard to live mode and repeat steps 1–3 to get live keys, a live price ID and a live webhook secret;
   - put them in Vercel and redeploy;
   - buy one real pass and refund it from the Stripe dashboard (the pass should disappear).
6. **Refunds:** refund from the Stripe dashboard (Payments → the payment → Refund). A full refund removes the pass automatically.

### 4. Anthropic (AI gift ideas)
1. console.anthropic.com → **API Keys → Create key**.
2. **Settings → Limits:** set a monthly spend limit (e.g. $50).

### 5. Resend (emails)
1. resend.com → **Domains → Add domain**. Add the DNS records it shows (SPF, DKIM, and a DMARC record) at your domain provider, then wait for "Verified".
2. **API Keys → Create** (sending access).

### 6. Google sign-in (optional)
1. console.cloud.google.com → create a project → **APIs & Services → OAuth consent screen**: type External, app name GiftLedger, your support email.
2. **Credentials → Create credentials → OAuth client ID**: type Web application, with Authorized redirect URI `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`.
3. In Supabase, go to **Authentication → Providers → Google**: turn it on and paste the client ID and secret.
4. In Vercel, set `NEXT_PUBLIC_GOOGLE_SIGN_IN=1` and redeploy. The "Continue with Google" button then appears.

### 7. PostHog and Sentry (optional, free tiers)
- **PostHog:** create a project (US cloud), copy the project API key and host. In **Project settings**, turn on **cookieless server hash mode** and **Discard client IP data**.
- **Sentry:** create a Next.js project and copy the DSN into both `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN`. In **Alerts**, send new issues to your email.

---

## Where every key lives

| Variable | What it is | Where to find it | Secret? |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project address | Supabase → Project Settings → API | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public database key (security rules protect the data) | Supabase → Project Settings → API (anon / publishable) | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Full database access, for the server only | Supabase → Project Settings → API (service_role / secret) | **Yes** |
| `STRIPE_SECRET_KEY` | Creates checkouts | Stripe → Developers → API keys | **Yes** |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Public Stripe key | Stripe → Developers → API keys | No |
| `STRIPE_PRICE_ID` | The $9.99 Season Pass price | Stripe → Product catalog → Season Pass | No |
| `STRIPE_WEBHOOK_SECRET` | Proves webhook messages come from Stripe | Stripe → Developers → Webhooks → your endpoint | **Yes** |
| `ANTHROPIC_API_KEY` | AI gift ideas | console.anthropic.com → API Keys | **Yes** |
| `RESEND_API_KEY` | Sends emails | resend.com → API Keys | **Yes** |
| `EMAIL_FROM` | Sender, e.g. `GiftLedger <hello@yourdomain.com>` | Your verified Resend domain | No |
| `ADMIN_EMAIL` | Your email, for the AI cost warning | You | No |
| `CRON_SECRET` | Stops strangers triggering the reminder job | Any long random string (`openssl rand -hex 32`) | **Yes** |
| `UNSUBSCRIBE_SECRET` | Signs unsubscribe links | Any long random string | **Yes** |
| `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST` | Analytics | PostHog → Project settings | No |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Error reports | Sentry → Project settings → Client Keys | No |
| `NEXT_PUBLIC_APP_URL` | Your site address, e.g. `https://giftledger.app` | You | No |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Contact address in the footer and legal pages | You | No |
| `NEXT_PUBLIC_GOOGLE_SIGN_IN` | `1` once Google sign-in is set up | You | No |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | The "are you a person?" check on sign-in | Cloudflare → Turnstile → your widget (Site Key). The Secret Key goes in Supabase only | No |

Keys starting with `NEXT_PUBLIC_` are visible in the browser by design, so none of them are secrets. Everything marked **Yes** must only ever be in Vercel's settings (and your password manager).

---

## Troubleshooting

- **Sign-in emails don't arrive:** check Supabase → Authentication → Logs, and Resend → Emails. The sending domain must be verified.
- **Paid but not unlocked:** check Stripe → Developers → Webhooks → your endpoint → recent deliveries. Each one should say 200. Stripe retries failed ones automatically.
- **No reminder emails:** check Vercel → the project → Cron Jobs (logs), and that the gift is Bought or Wrapped with a return-by date, on a list with a Season Pass.
- **"Gift ideas aren't switched on yet":** `ANTHROPIC_API_KEY` is missing in Vercel.
- **"We couldn't check that you're a person":** the Turnstile site key in Vercel doesn't match the widget, or your domain isn't on the widget's list in Cloudflare.
- **Sign-in says "Too many tries" for everyone:** the shared email budget (Supabase → Authentication → Rate Limits) is used up. Raise it, and make sure the CAPTCHA (step 1.9) is on.
- **"Invite emails are paused for today":** more than 500 invite emails went out in 24 hours (you'll get an email about it). It resumes by itself; people can still copy invite links.
