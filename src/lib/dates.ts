// Calendar dates are stored as "YYYY-MM-DD" with no time. A person's time zone
// only decides which date "today" is for them.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const RETURN_WINDOW_DAYS = 30;

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Today's date where the person is, e.g. "2026-11-14". */
export function todayInTimeZone(timeZone: string, now: Date = new Date()): string {
  const tz = isValidTimeZone(timeZone) ? timeZone : "America/New_York";
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const ms = new Date(`${toIso}T00:00:00Z`).getTime() - new Date(`${fromIso}T00:00:00Z`).getTime();
  return Math.round(ms / 86_400_000);
}

/** Suggested return-by date: 30 days after purchase (or after today, if no purchase date yet). */
export function suggestReturnBy(purchaseDate: string | null | undefined, today: string): string {
  return addDays(purchaseDate && isIsoDate(purchaseDate) ? purchaseDate : today, RETURN_WINDOW_DAYS);
}

/** "Nov 14", or "Nov 14, 2027" when it isn't this year. */
export function formatDate(isoDate: string, today?: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  const sameYear = today ? today.slice(0, 4) === isoDate.slice(0, 4) : true;
  return d.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}
