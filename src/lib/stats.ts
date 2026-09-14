/** Pure numeric helpers used by the readers and the trend calculations. No I/O. */

export interface Interval {
  lower: number;
  upper: number;
}

/**
 * Wilson score interval for a binomial proportion, so that a rate measured on three runs is
 * not ranked above the same rate measured on three hundred. Returns `[0, 1]` for `n = 0`.
 */
export function wilsonInterval(successes: number, n: number, z = 1.96): Interval {
  if (n <= 0) {
    return { lower: 0, upper: 1 };
  }
  const p = successes / n;
  const z2 = z * z;
  const denominator = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denominator;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denominator;
  return { lower: clamp(centre - half, 0, 1), upper: clamp(centre + half, 0, 1) };
}

/** Shannon entropy of a frequency table, normalised to `[0, 1]` (0 for a single category). */
export function normalisedEntropy(counts: readonly number[]): number {
  const total = counts.reduce((a, b) => a + b, 0);
  const nonZero = counts.filter((c) => c > 0);
  if (total === 0 || nonZero.length <= 1) {
    return 0;
  }
  let entropy = 0;
  for (const c of nonZero) {
    const p = c / total;
    entropy -= p * Math.log2(p);
  }
  return clamp(entropy / Math.log2(nonZero.length), 0, 1);
}

/**
 * Cramér's V for a contingency table (rows are one variable's categories, columns the other's).
 * Returns 0 when either variable has a single category or the table is empty.
 */
export function cramersV(table: readonly (readonly number[])[]): number {
  const rows = table.length;
  const cols = table[0]?.length ?? 0;
  if (rows < 2 || cols < 2) {
    return 0;
  }
  const rowTotals = table.map((r) => r.reduce((a, b) => a + b, 0));
  const colTotals = Array.from({ length: cols }, (_, j) =>
    table.reduce((sum, r) => sum + (r[j] ?? 0), 0),
  );
  const n = rowTotals.reduce((a, b) => a + b, 0);
  if (n === 0) {
    return 0;
  }
  let chi2 = 0;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const expected = ((rowTotals[i] ?? 0) * (colTotals[j] ?? 0)) / n;
      if (expected > 0) {
        const observed = table[i]?.[j] ?? 0;
        chi2 += (observed - expected) ** 2 / expected;
      }
    }
  }
  const k = Math.min(rows, cols) - 1;
  return clamp(Math.sqrt(chi2 / (n * k)), 0, 1);
}

export function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

export function round(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Difference between the last two values of a series, or 0 when there are fewer than two. */
export function lastDelta(values: readonly number[]): number {
  if (values.length < 2) {
    return 0;
  }
  const last = values[values.length - 1] ?? 0;
  const previous = values[values.length - 2] ?? 0;
  return last - previous;
}
