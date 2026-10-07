"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { checkPassStatus } from "@/app/app/upgrade/actions";
import { Button } from "@/components/ui/button";
import { SEASON_PASS_THROUGH } from "@/lib/season";

const CHECK_EVERY_MS = 1500;
const GIVE_UP_AFTER = 20; // about 30 seconds

export function PassStatus() {
  const [state, setState] = useState<"waiting" | "active" | "slow">("waiting");

  useEffect(() => {
    let tries = 0;
    let cancelled = false;
    async function check() {
      const { active } = await checkPassStatus();
      if (cancelled) return;
      if (active) return setState("active");
      if (++tries >= GIVE_UP_AFTER) return setState("slow");
      timer = setTimeout(check, CHECK_EVERY_MS);
    }
    let timer = setTimeout(check, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  if (state === "active") {
    return (
      <div className="space-y-4">
        <p role="status" className="text-lg">
          Your Season Pass is active through {SEASON_PASS_THROUGH}. Unlimited people, 100 idea requests, unlimited family
          members and return reminders are unlocked.
        </p>
        <Button asChild size="lg" className="w-full">
          <Link href="/app">Back to my list</Link>
        </Button>
      </div>
    );
  }
  if (state === "slow") {
    return (
      <div className="space-y-4">
        <p role="status">
          Your payment went through, and we&apos;re still confirming it with the bank. This usually takes under a minute.
          Refresh this page soon, or carry on and it will unlock by itself.
        </p>
        <Button asChild variant="outline" className="w-full">
          <Link href="/app">Back to my list</Link>
        </Button>
      </div>
    );
  }
  return (
    <p role="status" aria-busy="true" className="text-lg">
      Unlocking your Season Pass…
    </p>
  );
}
