import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { getListContext } from "@/lib/data/list";
import { hasActivePass, SEASON_PASS_PRICE_LABEL, SEASON_PASS_THROUGH, seasonOver } from "@/lib/season";
import { UpgradeButton } from "./upgrade-button";

export const metadata: Metadata = { title: "Season Pass" };

const BENEFITS = [
  "Unlimited people",
  "100 AI gift-idea requests",
  "Unlimited family members",
  "Return-window reminders by email",
];

export default async function UpgradePage({ searchParams }: PageProps<"/app/upgrade">) {
  const params = await searchParams;
  const ctx = await getListContext();
  const { data: profile } = await ctx.supabase.from("profiles").select("paid_until").eq("id", ctx.userId).single();
  const active = hasActivePass(profile?.paid_until);

  return (
    <div className="space-y-5 pt-2">
      <Link href="/app" className="inline-block py-2 text-sm text-muted-foreground underline-offset-4 hover:underline">
        ← Back to your list
      </Link>
      <h1 className="text-2xl font-bold">Season Pass</h1>

      {params.canceled === "1" && !active && (
        <p role="status" className="rounded-xl border p-4">
          Checkout canceled. You weren&apos;t charged.
        </p>
      )}

      {active ? (
        <div className="space-y-3 rounded-xl border border-ok/40 bg-ok/10 p-4">
          <p className="text-lg font-semibold">You have the Season Pass through {SEASON_PASS_THROUGH}. Thank you!</p>
          <p className="text-muted-foreground">It covers the list you own and everyone you invite to it.</p>
        </div>
      ) : (
        <p className="text-3xl font-bold">
          {SEASON_PASS_PRICE_LABEL}{" "}
          <span className="text-base font-normal text-muted-foreground">one time, good through {SEASON_PASS_THROUGH}</span>
        </p>
      )}

      <ul className="space-y-2">
        {BENEFITS.map((item) => (
          <li key={item} className="flex items-center gap-2">
            <Check aria-hidden className="size-5 text-ok-foreground" /> {item}
          </li>
        ))}
      </ul>

      {!active &&
        (seasonOver() ? (
          <p className="rounded-xl border p-4">The 2026 season has ended. Thanks for using GiftLedger!</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              It covers the list you own and everyone you invite to it. No subscription: you pay once and it simply ends
              after {SEASON_PASS_THROUGH}. Your lists and gifts stay yours either way.
            </p>
            {!ctx.isOwner && (
              <p className="text-sm text-muted-foreground">
                You&apos;re looking at someone else&apos;s list, which uses their plan. A Season Pass you buy covers your own
                list.
              </p>
            )}
            <UpgradeButton />
          </>
        ))}
    </div>
  );
}
