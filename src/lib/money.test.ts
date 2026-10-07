import { describe, expect, it } from "vitest";
import { centsToInput, dollarsToCents, formatCents } from "./money";

describe("dollarsToCents", () => {
  it.each([
    ["12", 1200],
    ["12.5", 1250],
    ["12.05", 1205],
    ["$1,299.99", 129999],
    [" 0 ", 0],
    ["0.99", 99],
    ["7.", 700],
  ])("%s → %d cents", (input, cents) => {
    expect(dollarsToCents(input)).toBe(cents);
  });

  it.each(["", "  ", "abc", "-5", "1.234", "12..5", "1e3", null, undefined])("rejects %s", (input) => {
    expect(dollarsToCents(input as string)).toBeNull();
  });

  it("never uses floating point (0.29 stays 29 cents)", () => {
    expect(dollarsToCents("0.29")).toBe(29);
    expect(dollarsToCents("1.10")).toBe(110);
  });
});

describe("formatCents", () => {
  it("formats whole and partial dollars", () => {
    expect(formatCents(1200)).toBe("$12");
    expect(formatCents(1250)).toBe("$12.50");
    expect(formatCents(129999)).toBe("$1,299.99");
    expect(formatCents(0)).toBe("$0");
    expect(formatCents(-500)).toBe("-$5");
    expect(formatCents(1200, { alwaysShowCents: true })).toBe("$12.00");
  });
});

describe("centsToInput", () => {
  it("round-trips with dollarsToCents", () => {
    for (const cents of [0, 5, 99, 100, 1250, 129999]) {
      expect(dollarsToCents(centsToInput(cents))).toBe(cents);
    }
    expect(centsToInput(null)).toBe("");
  });
});
