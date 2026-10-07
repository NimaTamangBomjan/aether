import type { BudgetState } from "@/lib/budget";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";

const TEXT: Record<BudgetState, string> = {
  ok: "text-ok-foreground",
  near: "text-near-foreground",
  over: "text-over-foreground",
  none: "text-muted-foreground",
};

/** "$46 of $50 · $4 left", "$5 over", or "$46 spent · no budget". */
export function BudgetText({ spent, budget, state, className }: { spent: number; budget: number | null; state: BudgetState; className?: string }) {
  if (budget == null) {
    return <span className={cn("text-muted-foreground", className)}>{formatCents(spent)} spent · no budget</span>;
  }
  const left = budget - spent;
  return (
    <span className={cn(className)}>
      <span>
        {formatCents(spent)} of {formatCents(budget)}
      </span>
      <span className={cn("font-semibold", TEXT[state])}>
        {" · "}
        {left >= 0 ? `${formatCents(left)} left` : `${formatCents(-left)} over`}
      </span>
    </span>
  );
}
