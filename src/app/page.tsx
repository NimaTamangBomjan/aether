import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Check, Gift, Lightbulb, Users, Wallet } from "lucide-react";
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
  "Give everyone a budget, get ideas when you're stuck, and share one list with your family so nobody buys the same gift twice.";

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
              <p className="text-sm text-muted-foreground">Free for up to 5 people. No card needed.</p>
            </div>
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
              <p className="text-sm text-muted-foreground">Not a subscription. It never renews.</p>
            </div>
          </div>
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
