import Link from "next/link";
import type { ReactNode } from "react";
import { formatDelta } from "@/lib/format";
import { Sparkline } from "./Sparkline";
import styles from "./StatTile.module.css";

interface StatTileProps {
  label: string;
  value: string;
  /** Small text under the value, for example "of 8 tests". */
  detail?: string;
  delta?: { value: number; digits?: number; unit?: string; upIsGood: boolean; versus: string };
  trend?: { values: readonly number[]; labels?: readonly string[]; title: string; max?: number };
  href: string;
  /** Rendered instead of value and trend when the tool has no data. */
  empty?: ReactNode;
  testId: string;
}

export function StatTile({
  label,
  value,
  detail,
  delta,
  trend,
  href,
  empty,
  testId,
}: StatTileProps) {
  const direction =
    delta === undefined ? 0 : Math.sign(Number(delta.value.toFixed(delta.digits ?? 0)));
  const deltaClass =
    direction === 0
      ? styles.deltaFlat
      : direction > 0 === delta?.upIsGood
        ? styles.deltaGood
        : styles.deltaBad;
  return (
    <section className={`card ${styles.tile}`} data-testid={testId}>
      <h2 className={styles.label}>
        <Link href={href}>{label}</Link>
      </h2>
      {empty !== undefined ? (
        <div className={styles.empty}>{empty}</div>
      ) : (
        <>
          <div className={styles.value} data-testid={`${testId}-value`}>
            {value}
          </div>
          {detail !== undefined && <div className={styles.detail}>{detail}</div>}
          {delta !== undefined && (
            <div className={`${styles.delta} ${deltaClass}`}>
              <span aria-hidden="true">{direction > 0 ? "▲" : direction < 0 ? "▼" : "•"}</span>{" "}
              {formatDelta(delta.value, delta.digits ?? 0, delta.unit ?? "")} {delta.versus}
            </div>
          )}
          {trend !== undefined && (
            <div className={styles.trend}>
              <Sparkline
                values={trend.values}
                labels={trend.labels}
                title={trend.title}
                max={trend.max}
              />
            </div>
          )}
        </>
      )}
    </section>
  );
}
