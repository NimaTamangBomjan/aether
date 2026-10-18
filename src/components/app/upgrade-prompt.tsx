import Link from "next/link";
import { Gift } from "lucide-react";
import { Button } from "@/components/ui/button";

export function UpgradePrompt({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="animate-reveal rounded-2xl border border-primary/30 bg-gradient-to-br from-secondary to-accent/60 p-5 shadow-xs"
    >
      <p className="mb-1 flex items-start gap-2.5 font-medium">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Gift aria-hidden className="size-5" />
        </span>
        {message}
      </p>
      <p className="mb-3 pl-[2.625rem] text-sm text-muted-foreground">One-time $9.99 for the whole season. Never renews.</p>
      <Button asChild className="w-full sm:w-auto">
        <Link href="/app/upgrade">See the Season Pass</Link>
      </Button>
    </div>
  );
}
