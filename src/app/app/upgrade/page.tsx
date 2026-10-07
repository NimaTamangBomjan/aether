import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";

export const metadata: Metadata = { title: "Season Pass" };

// Checkout is connected in Stage 5.
export default function UpgradePage() {
  return (
    <div className="space-y-5 pt-2">
      <Link href="/app" className="inline-block py-2 text-sm text-muted-foreground underline-offset-4 hover:underline">
        ← Back to your list
      </Link>
      <h1 className="text-2xl font-bold">Season Pass</h1>
      <p className="text-3xl font-bold">
        $9.99 <span className="text-base font-normal text-muted-foreground">one time, good through Jan 31, 2027</span>
      </p>
      <ul className="space-y-2">
        {["Unlimited people", "100 AI gift-idea requests", "Unlimited family members", "Return-window reminders by email"].map(
          (item) => (
            <li key={item} className="flex items-center gap-2">
              <Check aria-hidden className="size-5 text-ok-foreground" /> {item}
            </li>
          ),
        )}
      </ul>
      <p className="rounded-xl border border-dashed p-4 text-muted-foreground">
        Checkout is almost ready. Check back soon.
      </p>
    </div>
  );
}
