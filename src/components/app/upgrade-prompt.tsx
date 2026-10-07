import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function UpgradePrompt({ message }: { message: string }) {
  return (
    <div role="status" className="rounded-xl border border-primary/30 bg-secondary p-4">
      <p className="mb-3 flex items-start gap-2 font-medium">
        <Sparkles aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
        {message}
      </p>
      <Button asChild>
        <Link href="/app/upgrade">See the Season Pass</Link>
      </Button>
    </div>
  );
}
