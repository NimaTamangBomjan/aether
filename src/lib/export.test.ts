import { describe, expect, it } from "vitest";
import { buildExportCsv, csvCell, EXPORT_HEADER } from "./export";
import type { Gift, Recipient } from "./types";

const person = (over: Partial<Recipient>): Recipient =>
  ({
    id: "r1", list_id: "l1", name: "Grandma", relationship: "Grandparent", budget_cents: 5000, age_range: "senior",
    interests: ["birds", "tea"], notes: "", dont_buy_notes: "", linked_user_id: null, archived_at: null,
    created_by: null, created_at: "", updated_at: "", ...over,
  }) as Recipient;
const gift = (over: Partial<Gift>): Gift =>
  ({
    id: "g1", list_id: "l1", recipient_id: "r1", title: "Feeder", link: null, price_cents: 2499, quantity: 1, status: "bought",
    store: "Target", purchase_date: "2026-11-27", return_by: "2026-12-27", notes: "", bought_by: null,
    status_changed_by: null, status_changed_at: null, created_by: null, created_at: "", updated_at: "", ...over,
  }) as Gift;

describe("CSV cells", () => {
  it("quote commas, quotes and line breaks", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell("a, b")).toBe('"a, b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("two\nlines")).toBe('"two\nlines"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(3)).toBe("3");
  });
  it("stop spreadsheet formulas from running", () => {
    expect(csvCell("=HYPERLINK(\"http://evil\")")).toBe("\"'=HYPERLINK(\"\"http://evil\"\")\"");
    expect(csvCell("+1 555")).toBe("'+1 555");
    expect(csvCell("@sum")).toBe("'@sum");
  });
});

describe("export", () => {
  it("has one row per gift and a row for people with no gifts", () => {
    const csv = buildExportCsv([
      { name: "Holidays 2026", recipients: [person({}), person({ id: "r2", name: "Dad", interests: [] })], gifts: [gift({})] },
    ]);
    const lines = csv.replace("﻿", "").trim().split("\r\n");
    expect(lines[0]).toBe(EXPORT_HEADER.map(csvCell).join(","));
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe("Holidays 2026,Grandma,Grandparent,50,senior,birds; tea,,,,Feeder,Bought,24.99,1,Target,2026-11-27,2026-12-27,,");
    expect(lines[2].startsWith("Holidays 2026,Dad,")).toBe(true);
    expect(csv.startsWith("﻿")).toBe(true);
  });
});
