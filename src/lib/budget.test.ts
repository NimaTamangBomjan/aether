import { describe, expect, it } from "vitest";
import {
  budgetState,
  giftCost,
  progressPercent,
  sortPeople,
  spentCents,
  summarizeList,
  summarizePerson,
  type BudgetGift,
  type BudgetRecipient,
} from "./budget";

const person = (id: string, name: string, budget: number | null, archived = false): BudgetRecipient => ({
  id,
  name,
  budget_cents: budget,
  archived_at: archived ? "2026-11-01T00:00:00Z" : null,
});
const gift = (recipient_id: string, price: number | null, status: BudgetGift["status"], quantity = 1): BudgetGift => ({
  recipient_id,
  price_cents: price,
  status,
  quantity,
});

describe("spent totals", () => {
  it("count only Bought, Wrapped and Given gifts", () => {
    const gifts = [gift("a", 1000, "idea"), gift("a", 2000, "bought"), gift("a", 300, "wrapped"), gift("a", 40, "given")];
    expect(spentCents(gifts)).toBe(2340);
  });
  it("multiply price by quantity, and treat a missing price as $0", () => {
    expect(giftCost({ price_cents: 1250, quantity: 3 })).toBe(3750);
    expect(spentCents([gift("a", null, "bought"), gift("a", 500, "bought", 2)])).toBe(1000);
  });
});

describe("budget colors", () => {
  it("green under 90%, amber from 90% to 100%, red over", () => {
    expect(budgetState(0, 10000)).toBe("ok");
    expect(budgetState(8999, 10000)).toBe("ok");
    expect(budgetState(9000, 10000)).toBe("near");
    expect(budgetState(10000, 10000)).toBe("near");
    expect(budgetState(10001, 10000)).toBe("over");
  });
  it("grey with no budget; a $0 budget is only red once money is spent", () => {
    expect(budgetState(5000, null)).toBe("none");
    expect(budgetState(0, 0)).toBe("ok");
    expect(budgetState(1, 0)).toBe("over");
  });
  it("progress bar is capped at 100%", () => {
    expect(progressPercent(5000, 10000)).toBe(50);
    expect(progressPercent(20000, 10000)).toBe(100);
    expect(progressPercent(100, null)).toBe(0);
    expect(progressPercent(100, 0)).toBe(100);
  });
});

describe("people", () => {
  it("summarize one person's gifts only", () => {
    const s = summarizePerson(person("a", "Ann", 5000), [
      gift("a", 2000, "bought"),
      gift("a", 1500, "idea"),
      gift("b", 9999, "bought"),
    ]);
    expect(s.spent).toBe(2000);
    expect(s.planned).toBe(1500);
    expect(s.remaining).toBe(3000);
    expect(s.needsGift).toBe(false);
    expect(s.giftCount).toBe(2);
  });

  it("someone with only ideas still needs a gift", () => {
    expect(summarizePerson(person("a", "Ann", null), [gift("a", 100, "idea")]).needsGift).toBe(true);
  });

  it("sort people who still need a gift first, then by name", () => {
    const gifts = [gift("z", 100, "bought")];
    const sorted = sortPeople([
      summarizePerson(person("z", "Zed", null), gifts),
      summarizePerson(person("b", "bob", null), gifts),
      summarizePerson(person("a", "Amy", null), gifts),
    ]);
    expect(sorted.map((p) => p.recipient.name)).toEqual(["Amy", "bob", "Zed"]);
  });
});

describe("list totals", () => {
  const people = [person("a", "Ann", 5000), person("b", "Bob", 3000), person("c", "Cat", null), person("d", "Dan", 2000, true)];
  const gifts = [gift("a", 4600, "bought"), gift("b", 1000, "idea"), gift("d", 1500, "given")];

  it("use the overall budget when set, and show how much isn't assigned to anyone", () => {
    const s = summarizeList(20000, people, gifts);
    expect(s.totalBudget).toBe(20000);
    expect(s.budgetSource).toBe("overall");
    expect(s.unassigned).toBe(12000); // 200 - (50 + 30); archived Dan doesn't count
    expect(s.spent).toBe(6100); // includes the archived person's purchase
    expect(s.left).toBe(13900);
    expect(s.state).toBe("ok");
  });

  it("otherwise add up everyone's budgets", () => {
    const s = summarizeList(null, people, gifts);
    expect(s.totalBudget).toBe(8000);
    expect(s.budgetSource).toBe("people");
    expect(s.unassigned).toBeNull();
    expect(s.left).toBe(1900);
  });

  it("have no total when nobody has a budget", () => {
    const s = summarizeList(null, [person("x", "X", null)], []);
    expect(s.totalBudget).toBeNull();
    expect(s.left).toBeNull();
    expect(s.state).toBe("none");
  });

  it("split active and archived people and count who still needs a gift", () => {
    const s = summarizeList(null, people, gifts);
    expect(s.people.map((p) => p.recipient.name)).toEqual(["Bob", "Cat", "Ann"]);
    expect(s.archived.map((p) => p.recipient.name)).toEqual(["Dan"]);
    expect(s.stillNeedGift).toBe(2);
  });

  it("update immediately when a price or status changes", () => {
    const before = summarizeList(null, people, gifts);
    const after = summarizeList(null, people, [gift("a", 4600, "bought"), gift("b", 1000, "bought"), gift("d", 1500, "given")]);
    expect(after.spent - before.spent).toBe(1000);
    const priced = summarizeList(null, people, [gift("a", 5100, "bought"), gift("b", 1000, "idea"), gift("d", 1500, "given")]);
    expect(priced.people.find((p) => p.recipient.id === "a")?.state).toBe("over");
  });
});
