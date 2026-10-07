"use client";

import { useState, useTransition } from "react";
import { startCheckout } from "@/app/app/upgrade/actions";
import { Button } from "@/components/ui/button";
import { SEASON_PASS_PRICE_LABEL } from "@/lib/season";

export function UpgradeButton() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-3">
      <Button
        size="lg"
        className="w-full"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await startCheckout();
            if (result?.error) setError(result.error);
          })
        }
      >
        {pending ? "Opening secure checkout…" : `Upgrade for ${SEASON_PASS_PRICE_LABEL}`}
      </Button>
      <p className="text-center text-sm text-muted-foreground">Secure payment by Stripe.</p>
      {error && (
        <p role="alert" className="text-sm text-over-foreground">
          {error}
        </p>
      )}
    </div>
  );
}
