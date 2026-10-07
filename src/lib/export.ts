import { centsToInput } from "@/lib/money";
import { STATUS_LABEL, type Gift, type Recipient } from "@/lib/types";

/**
 * One CSV cell. Quotes when needed, and neutralizes text that spreadsheet apps would run as
 * a formula (cells starting with =, +, -, @, tab or carriage return).
 */
export function csvCell(value: string | number | null | undefined): string {
  if (value == null) return "";
  let text = String(value);
  // Also when spaces or line breaks come first: some spreadsheet apps skip those.
  if (typeof value === "string" && /^\s*[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export const EXPORT_HEADER = [
  "List",
  "Person",
  "Relationship",
  "Person budget",
  "Age range",
  "Interests",
  "Notes",
  "Don't buy",
  "Archived",
  "Gift",
  "Status",
  "Price each",
  "Quantity",
  "Store",
  "Bought on",
  "Return by",
  "Link",
  "Gift notes",
];

/** Everyone and every gift the person can see: one row per gift, plus a row for people without gifts. */
export function buildExportCsv(
  lists: { name: string; recipients: Recipient[]; gifts: Gift[] }[],
): string {
  const lines = [EXPORT_HEADER.map(csvCell).join(",")];
  for (const list of lists) {
    for (const person of list.recipients) {
      const personCells = [
        list.name,
        person.name,
        person.relationship,
        centsToInput(person.budget_cents),
        person.age_range ?? "",
        person.interests.join("; "),
        person.notes,
        person.dont_buy_notes,
        person.archived_at ? "yes" : "",
      ];
      const gifts = list.gifts.filter((g) => g.recipient_id === person.id);
      if (gifts.length === 0) lines.push([...personCells, ...Array(9).fill("")].map(csvCell).join(","));
      for (const g of gifts) {
        lines.push(
          [
            ...personCells,
            g.title,
            STATUS_LABEL[g.status],
            centsToInput(g.price_cents),
            g.quantity,
            g.store ?? "",
            g.purchase_date ?? "",
            g.return_by ?? "",
            g.link ?? "",
            g.notes,
          ]
            .map(csvCell)
            .join(","),
        );
      }
    }
  }
  // A byte-order mark so Excel opens accented names correctly; CRLF line endings for spreadsheets.
  return "﻿" + lines.join("\r\n") + "\r\n";
}
