import styles from "./Sparkline.module.css";

interface SparklineProps {
  values: readonly number[];
  labels?: readonly string[];
  /** Accessible description of the series, for example "Flaky executions per week". */
  title: string;
  width?: number;
  height?: number;
  /** Lowest value of the y range; defaults to the series minimum (0 when all values are ≥ 0). */
  min?: number;
  max?: number;
}

/**
 * A server-rendered inline SVG sparkline: a 2px line in the series hue with the current point
 * marked. It has no axes on purpose; the tile around it names the series and the headline.
 */
export function Sparkline({
  values,
  labels,
  title,
  width = 160,
  height = 40,
  min,
  max,
}: SparklineProps) {
  if (values.length === 0) {
    return <span className={styles.none}>no data</span>;
  }
  const pad = 5;
  const lo = min ?? Math.min(0, ...values);
  const hi = Math.max(max ?? Math.max(...values), lo + 1e-9);
  const x = (i: number) =>
    values.length === 1 ? width / 2 : pad + (i * (width - 2 * pad)) / (values.length - 1);
  const y = (v: number) => height - pad - ((v - lo) / (hi - lo)) * (height - 2 * pad);
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const lastIndex = values.length - 1;
  const last = values[lastIndex] ?? 0;
  const description = values
    .map((v, i) => `${labels?.[i] ?? String(i + 1)}: ${String(v)}`)
    .join(", ");
  return (
    <svg
      className={styles.svg}
      width={width}
      height={height}
      viewBox={`0 0 ${String(width)} ${String(height)}`}
      role="img"
      aria-label={`${title}. ${description}`}
    >
      <title>{title}</title>
      <polyline className={styles.line} points={points} />
      <circle className={styles.current} cx={x(lastIndex)} cy={y(last)} r={4} />
    </svg>
  );
}
