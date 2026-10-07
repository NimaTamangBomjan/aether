import type { GiftStatus } from "@/lib/types";

/** The parts of a gift that budget math needs. */
export type BudgetGift = { price_cents: number | null; quantity: number; status: GiftStatus; recipient_id: string };
export type BudgetRecipient = { id: string; name: string; budget_cents: number | null; archived_at: string | null };

export type BudgetState = "none" | "ok" | "near" | "over";

const COUNTS_AS_SPENT: ReadonlySet<GiftStatus> = new Set(["bought", "wrapped", "given"]);

/** Only Bought, Wrapped and Given gifts count as money spent. Price is per item. */
export function giftCost(gift: Pick<BudgetGift, "price_cents" | "quantity">): number {
  return (gift.price_cents ?? 0) * gift.quantity;
}

export function isPurchased(status: GiftStatus): boolean {
  return COUNTS_AS_SPENT.has(status);
}

export function spentCents(gifts: readonly BudgetGift[]): number {
  return gifts.reduce((sum, g) => (isPurchased(g.status) ? sum + giftCost(g) : sum), 0);
}

/** Green under budget, amber within 10% (90–100% used), red over. Grey when there's no budget. */
export function budgetState(spent: number, budget: number | null): BudgetState {
  if (budget == null) return "none";
  if (spent > budget) return "over";
  if (budget === 0) return "ok";
  if (spent >= budget * 0.9) return "near";
  return "ok";
}

/** Bar fill from 0 to 100. */
export function progressPercent(spent: number, budget: number | null): number {
  if (budget == null || budget <= 0) return spent > 0 && budget === 0 ? 100 : 0;
  return Math.min(100, Math.round((spent / budget) * 100));
}

export type PersonSummary = {
  recipient: BudgetRecipient;
  spent: number;
  planned: number;
  giftCount: number;
  purchasedCount: number;
  needsGift: boolean;
  remaining: number | null;
  state: BudgetState;
  percent: number;
};

export function summarizePerson(recipient: BudgetRecipient, gifts: readonly BudgetGift[]): PersonSummary {
  const own = gifts.filter((g) => g.recipient_id === recipient.id);
  const spent = spentCents(own);
  const purchasedCount = own.filter((g) => isPurchased(g.status)).length;
  return {
    recipient,
    spent,
    planned: own.filter((g) => g.status === "idea").reduce((s, g) => s + giftCost(g), 0),
    giftCount: own.length,
    purchasedCount,
    needsGift: purchasedCount === 0,
    remaining: recipient.budget_cents == null ? null : recipient.budget_cents - spent,
    state: budgetState(spent, recipient.budget_cents),
    percent: progressPercent(spent, recipient.budget_cents),
  };
}

/** People who still need a gift come first, then alphabetical. */
export function sortPeople(people: PersonSummary[]): PersonSummary[] {
  return [...people].sort((a, b) => {
    if (a.needsGift !== b.needsGift) return a.needsGift ? -1 : 1;
    return a.recipient.name.localeCompare(b.recipient.name, "en", { sensitivity: "base" });
  });
}

export type ListSummary = {
  people: PersonSummary[];
  archived: PersonSummary[];
  totalBudget: number | null;
  budgetSource: "overall" | "people" | "none";
  unassigned: number | null;
  spent: number;
  left: number | null;
  state: BudgetState;
  percent: number;
  stillNeedGift: number;
};

/**
 * Total budget is the overall budget when set, otherwise the sum of per-person budgets.
 * Spent counts every purchased gift the viewer can see, including for archived people.
 */
export function summarizeList(
  overallBudget: number | null,
  recipients: readonly BudgetRecipient[],
  gifts: readonly BudgetGift[],
): ListSummary {
  const all = recipients.map((r) => summarizePerson(r, gifts));
  const people = sortPeople(all.filter((p) => !p.recipient.archived_at));
  const archived = sortPeople(all.filter((p) => p.recipient.archived_at));

  const active = recipients.filter((r) => !r.archived_at);
  const withBudgets = active.filter((r) => r.budget_cents != null);
  const sumOfPeople = withBudgets.reduce((s, r) => s + (r.budget_cents ?? 0), 0);

  let totalBudget: number | null = null;
  let budgetSource: ListSummary["budgetSource"] = "none";
  if (overallBudget != null) {
    totalBudget = overallBudget;
    budgetSource = "overall";
  } else if (withBudgets.length > 0) {
    totalBudget = sumOfPeople;
    budgetSource = "people";
  }

  const spent = spentCents(gifts);
  return {
    people,
    archived,
    totalBudget,
    budgetSource,
    unassigned: budgetSource === "overall" && totalBudget != null ? totalBudget - sumOfPeople : null,
    spent,
    left: totalBudget == null ? null : totalBudget - spent,
    state: budgetState(spent, totalBudget),
    percent: progressPercent(spent, totalBudget),
    stillNeedGift: people.filter((p) => p.needsGift).length,
  };
}
