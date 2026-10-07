/** Turns what someone typed ("12", "12.5", "$1,299.99") into whole cents, or null if it isn't money. */
export function dollarsToCents(input: string | null | undefined): number | null {
  if (input == null) return null;
  const cleaned = input.trim().replace(/^\$/, "").replaceAll(",", "").trim();
  if (cleaned === "") return null;
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const [whole, fraction = ""] = cleaned.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

/** $12.50, or $12 when there are no cents. */
export function formatCents(cents: number, opts: { alwaysShowCents?: boolean } = {}): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const showCents = opts.alwaysShowCents || abs % 100 !== 0;
  const text = (abs / 100).toLocaleString("en-US", {
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  });
  return `${negative ? "-" : ""}$${text}`;
}

/** Value for a money input field: "12.50", or "" when empty. */
export function centsToInput(cents: number | null | undefined): string {
  if (cents == null) return "";
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}
