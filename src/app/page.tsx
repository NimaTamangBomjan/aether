import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Check, Gift, Lightbulb, Minus, Users, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/site/site-footer";

export const metadata: Metadata = {
  title: { absolute: "GiftLedger: stop overspending on holiday gifts" },
  description:
    "A budget for everyone on your list, gift ideas when you're stuck, a shared family list so nobody buys the same thing twice, and return reminders. Free to start.",
  alternates: { canonical: "/" },
};

// Headline: option 1 of 3 (the owner picks the final wording; see PROGRESS.md).
const HEADLINE = "Stop overspending on holiday gifts.";
const SUBHEAD =
  "Give everyone on your list a budget and see your total as you shop. Share one list with your family so nobody buys the same gift twice, and the surprises stay secret.";

// LendingTree's 2025 holiday debt survey (2,032 US adults, Dec 10–15, 2025): 48% of parents of kids
// under 18 took on holiday debt, averaging $1,324. Checked against the source on Oct 8, 2026.
const STAT = {
  figure: "48%",
  text: "of parents with kids at home took on debt for the holidays last season: $1,324 on average.",
  source: "LendingTree, 2025",
  url: "https://www.lendingtree.com/credit-cards/study/holiday-debt-tariffs/",
};

const COMPARISON: { feature: string; us: boolean; sheet: boolean; wishlist: boolean }[] = [
  { feature: "A budget for each person, with a running total", us: true, sheet: true, wishlist: false },
  { feature: "Your family sees what's already bought, right away", us: true, sheet: false, wishlist: true },
  { feature: "Gifts stay hidden from the person they're for", us: true, sheet: false, wishlist: true },
  { feature: "Gift ideas that fit what's left in the budget", us: true, sheet: false, wishlist: false },
  { feature: "A reminder before a return window closes", us: true, sheet: false, wishlist: false },
  { feature: "Easy on a phone, no download", us: true, sheet: false, wishlist: false },
  { feature: "No ads or shopping links", us: true, sheet: true, wishlist: false },
];

const PROMISES = [
  { title: "No ads, no shopping links", text: "We don't earn a cent from what you buy or where you buy it, so the ideas are just ideas." },
  { title: "One price, never a subscription", text: "Free for up to 5 people. $9.99 once for the whole season if you need more. It never renews." },
  { title: "Your list is safe", text: "Saved to your account as you go, on every phone you sign in on. Download a copy anytime." },
  { title: "Surprises stay surprises", text: "Hide any gift from anyone on the list. They won't see it on any page, in any total or email." },
];

const PROBLEMS = [
  "You don't see the total until the card bill arrives in January.",
  "You and your partner both bought the same Lego set.",
  "You've run out of ideas for your father-in-law.",
  "You find the receipt a week after the return window closed.",
];

const BENEFITS = [
  {
    icon: Wallet,
    title: "See every budget at a glance",
    text: "Set a budget for each person and watch it fill up: green, amber when you're close, red if you go over. Totals update the moment you mark something bought.",
    image: "/screenshots/person.webp",
    alt: "One person's page: $89 of $120 spent, a green budget bar, and their gifts",
  },
  {
    icon: Lightbulb,
    title: "Ideas when you're stuck",
    text: "Tap “Get gift ideas” for five suggestions that fit the person, their interests and what's left in their budget. Save the good ones with one tap.",
    image: "/screenshots/ideas.webp",
    alt: "Five gift ideas for a grandparent, each with a price and why it fits",
  },
  {
    icon: Users,
    title: "One list for the whole family",
    text: "Invite your partner or parents. Everyone sees what's been bought, so nobody doubles up, and you can hide a gift from the person it's for.",
    image: "/screenshots/family.webp",
    alt: "A gift marked bought by a family member, with the date",
  },
];

const STEPS = [
  { title: "Add the people you're buying for", text: "Give each one a budget. It takes a few seconds per person." },
  { title: "Save ideas and tap “bought”", text: "Your totals and colors update as you shop, even standing in the store." },
  { title: "Invite your family", text: "Share a link so everyone sees what's covered, and get a reminder before return windows close." },
];

const FAQ = [
  {
    q: "Is it really free?",
    a: "Yes. The free plan covers up to 5 people, 10 gift-idea requests and 1 family member. No card needed to start.",
  },
  {
    q: "Is the Season Pass a subscription?",
    a: "No. It's a one-time $9.99 payment that lasts through January 31, 2027, then simply ends. It never renews.",
  },
  {
    q: "Can my family see the gifts I'm buying them?",
    a: "Not if you don't want them to. Hide any gift from anyone on the list, or link a person to their family account so they never see gifts for themselves.",
  },
  {
    q: "Do I need to download an app?",
    a: "No. GiftLedger works in your phone's browser. You can add it to your home screen so it opens like an app.",
  },
  {
    q: "My parents aren't great with apps. Will they manage?",
    a: "Yes. You send them a link by text. They tap it, type their email, and enter the code we send. No app to download and no password to remember.",
  },
  {
    q: "Can I add a gift from a store's website?",
    a: "Yes. Paste the link from Amazon, Target or any store, and GiftLedger fills in the gift and store for you.",
  },
  {
    q: "What happens to my lists after January 31?",
    a: "They stay yours. You can still view, edit and export everything. Only the extra Season Pass features stop.",
  },
  {
    q: "Do you sell my data or show ads?",
    a: "Never. Payments are handled securely by Stripe, and we never see your card number. Read our Privacy Policy for the details.",
  },
];

export default function Home() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold text-primary">
          <Gift aria-hidden className="size-5" /> GiftLedger
        </Link>
        <Button asChild variant="ghost" size="sm">
          <Link href="/sign-in">Sign in</Link>
        </Button>
      </header>

      <main>
        <section className="mx-auto grid w-full max-w-5xl items-center gap-8 px-4 pt-6 pb-12 md:grid-cols-2 md:pt-12">
          <div className="space-y-5">
            <h1 className="text-4xl leading-tight font-bold md:text-5xl">{HEADLINE}</h1>
            <p className="text-lg text-muted-foreground">{SUBHEAD}</p>
            <div className="space-y-2">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href="/sign-in">Start free</Link>
              </Button>
              <p className="text-sm text-muted-foreground">Free for up to 5 people. No card, no download.</p>
            </div>
            <p className="rounded-xl bg-secondary/60 p-4">
              <span className="text-2xl font-bold text-primary">{STAT.figure}</span> {STAT.text}{" "}
              <a href={STAT.url} className="text-sm text-muted-foreground underline underline-offset-4" rel="noopener noreferrer" target="_blank">
                ({STAT.source})
              </a>
            </p>
          </div>
          <div className="mx-auto w-full max-w-xs">
            <Image
              src="/screenshots/dashboard.webp"
              alt="GiftLedger on a phone: holiday budget, spent and left, and a budget bar for each person"
              width={750}
              height={1300}
              priority
              sizes="(min-width: 768px) 320px, 80vw"
              className="rounded-3xl border shadow-lg"
            />
          </div>
        </section>

        <section aria-labelledby="problem" className="bg-secondary/60">
          <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-12">
            <h2 id="problem" className="text-2xl font-bold">
              Sound familiar?
            </h2>
            <ul className="space-y-3">
              {PROBLEMS.map((p) => (
                <li key={p} className="rounded-xl bg-card p-4 shadow-xs">
                  {p}
                </li>
              ))}
            </ul>
            <p className="text-lg">GiftLedger keeps all of it in one place, on your phone, in a few taps.</p>
            <p className="text-muted-foreground">
              Already started shopping? It&apos;s not too late: add what you&apos;ve bought in a minute and see exactly where you stand.
            </p>
          </div>
        </section>

        <section aria-labelledby="benefits" className="mx-auto w-full max-w-5xl space-y-14 px-4 py-14">
          <h2 id="benefits" className="sr-only">
            What GiftLedger does
          </h2>
          {BENEFITS.map((b, i) => (
            <div key={b.title} className="grid items-center gap-8 md:grid-cols-2">
              <div className={i % 2 ? "space-y-3 md:order-2" : "space-y-3"}>
                <b.icon aria-hidden className="size-8 text-primary" />
                <h3 className="text-2xl font-bold">{b.title}</h3>
                <p className="text-lg text-muted-foreground">{b.text}</p>
              </div>
              <div className="mx-auto w-full max-w-xs">
                <Image src={b.image} alt={b.alt} width={750} height={1300} sizes="(min-width: 768px) 320px, 80vw" className="rounded-3xl border shadow-md" />
              </div>
            </div>
          ))}
        </section>

        <section aria-labelledby="compare" className="mx-auto w-full max-w-3xl space-y-5 px-4 pb-14">
          <h2 id="compare" className="text-2xl font-bold">
            Why not a spreadsheet, or a wish-list app?
          </h2>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-left text-sm">
              <thead className="bg-secondary/60">
                <tr>
                  <th scope="col" className="p-3 font-medium">
                    <span className="sr-only">Feature</span>
                  </th>
                  <th scope="col" className="p-3 text-center font-semibold text-primary">
                    GiftLedger
                  </th>
                  <th scope="col" className="p-3 text-center font-medium">
                    Spreadsheet
                  </th>
                  <th scope="col" className="p-3 text-center font-medium">
                    Wish-list apps
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row) => (
                  <tr key={row.feature} className="border-t">
                    <th scope="row" className="p-3 font-normal">
                      {row.feature}
                    </th>
                    {[row.us, row.sheet, row.wishlist].map((yes, i) => (
                      <td key={i} className="p-3 text-center">
                        {yes ? (
                          <Check aria-label="Yes" className="mx-auto size-5 text-ok-foreground" />
                        ) : (
                          <Minus aria-label="No" className="mx-auto size-5 text-muted-foreground" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="how" className="bg-secondary/60">
          <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-12">
            <h2 id="how" className="text-2xl font-bold">
              How it works
            </h2>
            <ol className="grid gap-4 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s.title} className="space-y-2 rounded-xl bg-card p-5 shadow-xs">
                  <span className="flex size-9 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  <h3 className="text-lg font-semibold">{s.title}</h3>
                  <p className="text-muted-foreground">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section aria-labelledby="pricing" className="mx-auto w-full max-w-5xl space-y-6 px-4 py-14">
          <h2 id="pricing" className="text-2xl font-bold">
            Simple pricing
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-4 rounded-2xl border bg-card p-6">
              <h3 className="text-xl font-bold">Free</h3>
              <p className="text-3xl font-bold">$0</p>
              <ul className="space-y-2">
                {["Up to 5 people", "10 gift-idea requests", "1 family member", "Budgets, totals and colors"].map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check aria-hidden className="size-5 shrink-0 text-ok-foreground" /> {f}
                  </li>
                ))}
              </ul>
              <Button asChild variant="outline" className="w-full">
                <Link href="/sign-in">Start free</Link>
              </Button>
            </div>
            <div className="space-y-4 rounded-2xl border-2 border-primary bg-card p-6">
              <h3 className="text-xl font-bold">Season Pass</h3>
              <p className="text-3xl font-bold">
                $9.99 <span className="text-base font-normal text-muted-foreground">one time, through Jan 31, 2027</span>
              </p>
              <ul className="space-y-2">
                {["Unlimited people", "100 gift-idea requests", "Unlimited family members", "Return-window reminders by email"].map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check aria-hidden className="size-5 shrink-0 text-ok-foreground" /> {f}
                  </li>
                ))}
              </ul>
              <Button asChild className="w-full">
                <Link href="/sign-in">Start free, upgrade anytime</Link>
              </Button>
              <p className="text-sm text-muted-foreground">Not a subscription. It never renews. One missed return pays for it.</p>
            </div>
          </div>
        </section>

        <section aria-labelledby="promises" className="mx-auto w-full max-w-5xl space-y-6 px-4 pb-14">
          <h2 id="promises" className="text-2xl font-bold">
            Our promises
          </h2>
          <ul className="grid gap-4 md:grid-cols-2">
            {PROMISES.map((p) => (
              <li key={p.title} className="space-y-1 rounded-xl border bg-card p-5">
                <h3 className="font-semibold">{p.title}</h3>
                <p className="text-muted-foreground">{p.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="faq" className="bg-secondary/60">
          <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-12">
            <h2 id="faq" className="text-2xl font-bold">
              Questions
            </h2>
            {FAQ.map((f) => (
              <details key={f.q} className="rounded-xl bg-card p-4 shadow-xs">
                <summary className="cursor-pointer py-1 font-semibold">{f.q}</summary>
                <p className="mt-2 text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-3xl space-y-5 px-4 py-14 text-center">
          <h2 className="text-3xl font-bold">This year, know exactly where the gift money goes.</h2>
          <Button asChild size="lg">
            <Link href="/sign-in">Start your list, free</Link>
          </Button>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
