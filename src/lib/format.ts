/** Formatting helpers shared by pages and components. Pure functions, no locale surprises. */

export function formatPercent(rate: number, digits = 0): string {
  return `${(rate * 100).toFixed(digits)}%`;
}

export function formatScore(score: number | null | undefined, digits = 2): string {
  return score === null || score === undefined ? "n/a" : score.toFixed(digits);
}

/** `2026-09-10` for an ISO instant or date, or an empty string for nothing. */
export function formatDate(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString().slice(0, 10);
}

/** `2026-09-10 21:00` in UTC. */
export function formatDateTime(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toISOString().slice(0, 16).replace("T", " ");
}

/** Signed delta text such as `+3`, `-0.05` or `+2.1 pts`; `0` becomes `±0`. */
export function formatDelta(delta: number, digits = 0, unit = ""): string {
  const rounded = Number(delta.toFixed(digits));
  const sign = rounded > 0 ? "+" : rounded < 0 ? "-" : "±";
  return `${sign}${Math.abs(rounded).toFixed(digits)}${unit}`;
}

/** Shortens `com.acme.shop.CheckoutTest#appliesCoupon` to `CheckoutTest#appliesCoupon`. */
export function shortTestId(testId: string): string {
  const hash = testId.indexOf("#");
  const className = hash === -1 ? testId : testId.slice(0, hash);
  const method = hash === -1 ? "" : testId.slice(hash);
  const simple = className.slice(className.lastIndexOf(".") + 1);
  return `${simple}${method}`;
}

export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
