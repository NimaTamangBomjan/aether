import { describe, expect, it } from "vitest";
import { hasActivePass, SEASON_PASS_END, seasonOver } from "./season";

describe("Season Pass dates", () => {
  it("ends at the end of Jan 31, 2027 in New York", () => {
    expect(SEASON_PASS_END.toLocaleString("en-US", { timeZone: "America/New_York" })).toBe("2/1/2027, 12:00:00 AM");
  });
  it("is active until it ends", () => {
    const end = SEASON_PASS_END.toISOString();
    expect(hasActivePass(end, new Date("2026-11-27T12:00:00Z"))).toBe(true);
    expect(hasActivePass(end, new Date("2027-01-31T23:59:00-05:00"))).toBe(true);
    expect(hasActivePass(end, new Date("2027-02-01T00:00:01-05:00"))).toBe(false);
    expect(hasActivePass(null)).toBe(false);
  });
  it("stops selling once the season is over", () => {
    expect(seasonOver(new Date("2026-12-24T12:00:00Z"))).toBe(false);
    expect(seasonOver(new Date("2027-02-01T05:00:00Z"))).toBe(true);
  });
});
