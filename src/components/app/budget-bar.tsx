import type { BudgetState } from "@/lib/budget";
import { cn } from "@/lib/utils";

const FILL: Record<BudgetState, string> = {
  ok: "bg-ok",
  near: "bg-near",
  over: "bg-over",
  none: "bg-muted-foreground/30",
};

export function BudgetBar({ percent, state, label, className }: { percent: number; state: BudgetState; label: string; className?: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={cn("h-2.5 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div className={cn("h-full rounded-full transition-[width] duration-300", FILL[state])} style={{ width: `${percent}%` }} />
    </div>
  );
}
