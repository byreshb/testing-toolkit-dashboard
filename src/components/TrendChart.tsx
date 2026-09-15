"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import styles from "./TrendChart.module.css";

export interface TrendPoint {
  label: string;
  value: number;
  /** Extra text for the tooltip, for example "3 of 21 executions". */
  note?: string;
}

/** How to render a value on the axis and in the tooltip. A server component can only pass
 * serialisable props to a client component, so this is a format *name*, not a function. */
export type TrendFormat = "count" | "percent" | "score";

interface TrendChartProps {
  points: readonly TrendPoint[];
  /** Name of the measure, shown in the tooltip. */
  name: string;
  format?: TrendFormat;
  max?: number;
  height?: number;
}

function formatValue(value: number, format: TrendFormat): string {
  switch (format) {
    case "percent":
      return `${(value * 100).toFixed(0)}%`;
    case "score":
      return value.toFixed(2);
    case "count":
    default:
      return String(value);
  }
}

/** A single-series line chart with a hover tooltip; the heading around it names the series. */
export function TrendChart({
  points,
  name,
  format: formatKind = "count",
  max,
  height = 220,
}: TrendChartProps) {
  const format = (v: number) => formatValue(v, formatKind);
  return (
    <div className={styles.chart} style={{ height }} data-testid="trend-chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={[...points]} margin={{ top: 12, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--fg-muted)", fontSize: 12 }}
            stroke="var(--axis)"
            tickLine={false}
          />
          <YAxis
            domain={[0, max ?? "auto"]}
            tick={{ fill: "var(--fg-muted)", fontSize: 12 }}
            stroke="var(--axis)"
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(v: number) => format(v)}
          />
          <Tooltip
            contentStyle={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              color: "var(--fg)",
              fontSize: 13,
            }}
            labelStyle={{ color: "var(--fg-secondary)" }}
            formatter={(value, _name, item) => {
              const point = item.payload as TrendPoint;
              const text = format(Number(value));
              return [point.note === undefined ? text : `${text} (${point.note})`, name];
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            name={name}
            stroke="var(--series-1)"
            strokeWidth={2}
            dot={{ r: 4, fill: "var(--series-1)", stroke: "var(--bg-elevated)", strokeWidth: 2 }}
            activeDot={{ r: 6 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
