import { describe, expect, it } from "vitest";
import { addDays, daysBetween, formatDate, isIsoDate, isValidTimeZone, suggestReturnBy, todayInTimeZone } from "./dates";

describe("today in a time zone", () => {
  // 03:30 UTC on Nov 15 is still the evening of Nov 14 in New York and Los Angeles.
  const lateNight = new Date("2026-11-15T03:30:00Z");
  it("depends on where the person is", () => {
    expect(todayInTimeZone("America/New_York", lateNight)).toBe("2026-11-14");
    expect(todayInTimeZone("America/Los_Angeles", lateNight)).toBe("2026-11-14");
    expect(todayInTimeZone("Europe/London", lateNight)).toBe("2026-11-15");
    expect(todayInTimeZone("Pacific/Auckland", lateNight)).toBe("2026-11-15");
  });
  it("handles the daylight-saving change on Nov 1", () => {
    expect(todayInTimeZone("America/New_York", new Date("2026-11-01T04:30:00Z"))).toBe("2026-11-01");
    expect(todayInTimeZone("America/New_York", new Date("2026-11-02T04:30:00Z"))).toBe("2026-11-01");
  });
  it("falls back to Eastern time for an unknown zone", () => {
    expect(todayInTimeZone("Mars/Base", lateNight)).toBe("2026-11-14");
    expect(isValidTimeZone("Mars/Base")).toBe(false);
    expect(isValidTimeZone("America/Chicago")).toBe(true);
  });
});

describe("calendar math", () => {
  it("adds days across months and years", () => {
    expect(addDays("2026-11-25", 30)).toBe("2026-12-25");
    expect(addDays("2026-12-15", 30)).toBe("2027-01-14");
    expect(addDays("2026-11-17", -3)).toBe("2026-11-14");
  });
  it("counts days between dates", () => {
    expect(daysBetween("2026-11-14", "2026-11-17")).toBe(3);
    expect(daysBetween("2026-11-17", "2026-11-17")).toBe(0);
  });
  it("validates dates", () => {
    expect(isIsoDate("2026-11-14")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("11/14/2026")).toBe(false);
  });
});

describe("return-by suggestion", () => {
  it("is 30 days after the purchase date", () => {
    expect(suggestReturnBy("2026-11-27", "2026-12-01")).toBe("2026-12-27");
  });
  it("uses today when there's no purchase date yet", () => {
    expect(suggestReturnBy(null, "2026-11-10")).toBe("2026-12-10");
    expect(suggestReturnBy("", "2026-11-10")).toBe("2026-12-10");
  });
});

describe("formatting", () => {
  it("shows short dates without shifting the day", () => {
    expect(formatDate("2026-11-14", "2026-11-01")).toBe("Nov 14");
    expect(formatDate("2027-01-14", "2026-11-01")).toBe("Jan 14, 2027");
  });
});
