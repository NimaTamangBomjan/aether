import { describe, expect, it } from "vitest";
import { fieldErrors, giftInput, recipientInput } from "./validation";

describe("person form", () => {
  it("accepts a typical person and cleans it up", () => {
    const r = recipientInput.parse({
      name: "  Grandma Rose ",
      relationship: "Grandparent",
      budget: "$50",
      age_range: "senior",
      interests: "gardening, tea , , gardening, mystery novels",
      notes: "Loves birds",
      dont_buy_notes: "No more mugs",
    });
    expect(r).toEqual({
      name: "Grandma Rose",
      relationship: "Grandparent",
      budget: 5000,
      age_range: "senior",
      interests: ["gardening", "tea", "mystery novels"],
      notes: "Loves birds",
      dont_buy_notes: "No more mugs",
      linked_user_id: null,
    });
  });

  it("accepts a link to a family member, or none", () => {
    const id = "6f1c2a7e-3b4d-4c5e-8f9a-0b1c2d3e4f5a";
    expect(recipientInput.parse({ name: "A", linked_user_id: id }).linked_user_id).toBe(id);
    expect(recipientInput.parse({ name: "A", linked_user_id: "" }).linked_user_id).toBeNull();
    expect(recipientInput.safeParse({ name: "A", linked_user_id: "not-an-id" }).success).toBe(false);
  });

  it("only needs a name", () => {
    const r = recipientInput.parse({ name: "Sam" });
    expect(r.budget).toBeNull();
    expect(r.age_range).toBeNull();
    expect(r.interests).toEqual([]);
  });

  it("explains what's wrong in plain words", () => {
    const res = recipientInput.safeParse({ name: "  ", budget: "fifty", age_range: "ancient" });
    expect(res.success).toBe(false);
    const errors = fieldErrors(res.error!);
    expect(errors.name).toBe("Add a name.");
    expect(errors.budget).toBe("Budget should be an amount like 25 or 24.99.");
    expect(errors.age_range).toBeDefined();
  });

  it("limits interests", () => {
    const many = Array.from({ length: 21 }, (_, i) => `i${i}`).join(",");
    expect(recipientInput.safeParse({ name: "A", interests: many }).success).toBe(false);
  });
});

describe("gift form", () => {
  it("accepts a full gift", () => {
    const g = giftInput.parse({
      title: "Bird feeder",
      link: "https://example.com/feeder",
      price: "24.99",
      quantity: "2",
      status: "bought",
      store: "Target",
      purchase_date: "2026-11-27",
      return_by: "2026-12-27",
      notes: "",
      bought_by: "",
    });
    expect(g.price).toBe(2499);
    expect(g.quantity).toBe(2);
    expect(g.store).toBe("Target");
    expect(g.bought_by).toBeNull();
  });

  it("rejects unsafe or broken links and bad dates", () => {
    expect(giftInput.safeParse({ title: "x", link: "javascript:alert(1)" }).success).toBe(false);
    expect(giftInput.safeParse({ title: "x", link: "ftp://example.com" }).success).toBe(false);
    expect(giftInput.safeParse({ title: "x", return_by: "2026-02-30" }).success).toBe(false);
    expect(giftInput.safeParse({ title: "x", quantity: "0" }).success).toBe(false);
    expect(giftInput.safeParse({ title: "x", status: "lost" }).success).toBe(false);
  });

  it("defaults to one idea with no link", () => {
    const g = giftInput.parse({ title: "Socks" });
    expect(g).toMatchObject({ quantity: 1, status: "idea", link: null, price: null, store: null });
  });
});
