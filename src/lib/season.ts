/** The Season Pass runs through Jan 31, 2027, end of day US Eastern (matches the database). */
export const SEASON_PASS_END = new Date("2027-02-01T05:00:00Z");
export const SEASON_PASS_PRICE_LABEL = "$9.99";
export const SEASON_PASS_THROUGH = "Jan 31, 2027";

export function hasActivePass(paidUntil: string | null | undefined, now: Date = new Date()): boolean {
  return Boolean(paidUntil) && new Date(paidUntil!).getTime() > now.getTime();
}

/** After the season ends there's nothing left to sell. */
export function seasonOver(now: Date = new Date()): boolean {
  return now.getTime() >= SEASON_PASS_END.getTime();
}
