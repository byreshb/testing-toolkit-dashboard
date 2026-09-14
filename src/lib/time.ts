/** Date helpers for bucketing runs into calendar weeks and reporting ages. All UTC. */

const DAY_MS = 86_400_000;

/** Monday 00:00 UTC of the week containing `date`, as an ISO date (`YYYY-MM-DD`). */
export function weekStart(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const weekday = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - weekday);
  return isoDate(d);
}

/** `YYYY-MM-DD` of a date, in UTC. */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (negative when `to` is earlier), ignoring time of day. */
export function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.round((b - a) / DAY_MS);
}

/** Parses an ISO 8601 date or instant; returns `undefined` for anything else. */
export function parseInstant(value: unknown): Date | undefined {
  if (typeof value !== "string" || value === "") {
    return undefined;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

/** The week starts (Monday, ISO date) of the last `count` weeks ending with the week of `now`. */
export function recentWeeks(now: Date, count: number): string[] {
  const weeks: string[] = [];
  const current = new Date(weekStart(now) + "T00:00:00Z");
  for (let i = count - 1; i >= 0; i--) {
    weeks.push(isoDate(new Date(current.getTime() - i * 7 * DAY_MS)));
  }
  return weeks;
}
