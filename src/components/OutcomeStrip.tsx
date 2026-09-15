import type { BuildExecution } from "@/data/flake";
import { formatDateTime } from "@/lib/format";
import styles from "./OutcomeStrip.module.css";

type Cell = "pass" | "fail" | "recovered" | "skipped";

function cellOf(execution: BuildExecution): Cell {
  if (execution.final === "SKIPPED") {
    return "skipped";
  }
  if (execution.final === "PASS") {
    return execution.flaky ? "recovered" : "pass";
  }
  return "fail";
}

const LETTER: Record<Cell, string> = { pass: "P", fail: "F", recovered: "R", skipped: "S" };
const WORD: Record<Cell, string> = {
  pass: "passed",
  fail: "failed",
  recovered: "passed after a retry",
  skipped: "skipped",
};

/** One lettered cell per build, oldest first: P passed, R passed after a retry, F failed, S skipped. */
export function OutcomeStrip({
  history,
  limit = 30,
}: {
  history: readonly BuildExecution[];
  limit?: number;
}) {
  const recent = history.slice(-limit);
  return (
    <ol className={styles.strip} aria-label="Outcome per build, oldest first">
      {recent.map((execution) => {
        const cell = cellOf(execution);
        return (
          <li
            key={execution.buildId}
            className={`${styles.cell} ${styles[cell] ?? ""}`}
            title={`${formatDateTime(execution.timestamp)} ${execution.commit}: ${WORD[cell]} (${execution.outcomes.join(" → ")})`}
          >
            <span className={styles.letter}>{LETTER[cell]}</span>
            <span className={styles.srOnly}>{WORD[cell]}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function OutcomeLegend() {
  return (
    <p className={`${styles.legend} muted`}>
      <span className={`${styles.cell} ${styles.pass}`}>P</span> passed{" "}
      <span className={`${styles.cell} ${styles.recovered}`}>R</span> passed after a retry{" "}
      <span className={`${styles.cell} ${styles.fail}`}>F</span> failed{" "}
      <span className={`${styles.cell} ${styles.skipped}`}>S</span> skipped
    </p>
  );
}
