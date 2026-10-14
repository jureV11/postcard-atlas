/** Today's date as YYYY-MM-DD in the user's local timezone. */
export function todayLocal(): string {
  return new Date().toLocaleDateString("en-CA");
}

/** "12 Mar 2026" from a YYYY-MM-DD date column. */
export function formatDate(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Whole days between two YYYY-MM-DD dates. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}
