import { EmptyState } from "@/components/EmptyState";
import { Sparkline } from "@/components/Sparkline";
import { TrendChart } from "@/components/TrendChart";
import type { Severity } from "@/data/tql";
import { formatDate, pluralise } from "@/lib/format";
import { dashboardContext } from "@/server/context";
import { qualityView } from "@/server/quality";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const SEVERITY_BADGE: Record<Severity, string> = { ERROR: "critical", WARN: "warning", INFO: "" };

export default function QualityPage() {
  const context = dashboardContext();
  const view = qualityView(context);
  if (view === undefined) {
    return (
      <>
        <h1>Test quality</h1>
        <EmptyState tool="test-quality linter" expected="target/tql/*.sarif or *.json" />
      </>
    );
  }
  const { runs, summary, rules, worstFiles } = view;
  const latest = runs[runs.length - 1];

  return (
    <>
      <h1>Test quality</h1>
      <p className={styles.summary}>
        <span>
          <strong>{summary.latestFindings}</strong> findings in the latest run
        </span>
        <span>
          {summary.bySeverity.ERROR} error, {summary.bySeverity.WARN} warn,{" "}
          {summary.bySeverity.INFO} info
        </span>
        <span>{pluralise(summary.runs, "run")} recorded</span>
        <span>latest run {formatDate(summary.latestRunAt)}</span>
      </p>

      <h2>Findings over time</h2>
      <TrendChart
        name="Findings"
        points={summary.trend.map((r) => ({
          label: formatDate(r.startedAt),
          value: r.findings,
          note: r.commit === null ? undefined : r.commit,
        }))}
      />

      <h2>Findings per rule</h2>
      <p className="muted">Worst rule first, by count in the latest run.</p>
      <div className="tableWrap">
        <table data-testid="rules-table">
          <thead>
            <tr>
              <th>Rule</th>
              <th>Severity</th>
              <th className="num">Latest</th>
              <th>Trend</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.ruleId} data-testid="rule-row">
                <td>
                  <span className={styles.rule}>{r.ruleId}</span> {r.rule}
                </td>
                <td>
                  <span className={`badge ${SEVERITY_BADGE[r.severity]}`}>{r.severity}</span>
                </td>
                <td className="num">{r.latest}</td>
                <td>
                  <Sparkline
                    values={r.counts}
                    labels={summary.trend.map((t) => formatDate(t.startedAt))}
                    title={`${r.ruleId} findings per run`}
                    width={100}
                    height={28}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Worst files</h2>
      <p className="muted">From the latest run, {formatDate(summary.latestRunAt)}.</p>
      {worstFiles.length === 0 ? (
        <p className="muted">No findings in the latest run.</p>
      ) : (
        <div className="tableWrap">
          <table data-testid="worst-files-table">
            <thead>
              <tr>
                <th>File</th>
                <th className="num">Findings</th>
                <th className="num">Error</th>
                <th className="num">Warn</th>
                <th className="num">Info</th>
              </tr>
            </thead>
            <tbody>
              {worstFiles.map((f) => (
                <tr key={f.file} data-testid="worst-file-row">
                  <td className={styles.location}>{f.file}</td>
                  <td className="num">{f.count}</td>
                  <td className="num">{f.bySeverity.ERROR}</td>
                  <td className="num">{f.bySeverity.WARN}</td>
                  <td className="num">{f.bySeverity.INFO}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2>Latest findings</h2>
      {latest === undefined || latest.findings.length === 0 ? (
        <p className="muted">No findings in the latest run.</p>
      ) : (
        <ul className={styles.findingsList} data-testid="findings-list">
          {latest.findings.map((f, i) => (
            <li key={`${f.ruleId}-${f.file}-${f.line}-${i}`} className={`card ${styles.finding}`}>
              <div className={styles.findingHead}>
                <span className={`badge ${SEVERITY_BADGE[f.severity]}`}>{f.severity}</span>
                <span className={styles.rule}>{f.ruleId}</span>
                <span className={styles.location}>
                  {f.file}:{f.line}
                  {f.column > 0 ? `:${String(f.column)}` : ""}
                </span>
              </div>
              <p className={styles.message}>{f.message}</p>
              {f.fixHint !== undefined && <p className={styles.fixHint}>Fix: {f.fixHint}</p>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
