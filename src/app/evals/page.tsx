import { EmptyState } from "@/components/EmptyState";
import { TrendChart } from "@/components/TrendChart";
import { formatDate, formatDelta, formatPercent, formatScore } from "@/lib/format";
import { dashboardContext, type PageSearchParams } from "@/server/context";
import { evalsView } from "@/server/evals";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function EvalsPage({ searchParams }: { searchParams: PageSearchParams }) {
  const { repo } = await searchParams;
  const context = dashboardContext(repo);
  const view = evalsView(context);
  if (view === undefined) {
    return (
      <>
        <h1>LLM evals</h1>
        <EmptyState tool="LLM eval harness" expected="target/llm-eval/*.json" />
      </>
    );
  }
  const { summary, variants, latest, tags, drift } = view;

  return (
    <>
      <h1>LLM evals</h1>
      <p className={styles.summary}>
        <span>
          <strong>{formatScore(summary.latestMeanScore)}</strong> mean score, pass rate{" "}
          {formatPercent(summary.latestPassRate ?? 0)}
        </span>
        <span>
          {summary.latestPrompt === null
            ? "no prompt recorded"
            : `${summary.latestPrompt.name} v${String(summary.latestPrompt.version)}`}{" "}
          on {summary.latestModel ?? "unknown model"}
        </span>
        <span>{summary.runs} runs recorded</span>
        <span>latest run {formatDate(summary.latestRunAt)}</span>
      </p>

      <h2>Score over time</h2>
      <TrendChart
        name="Mean score"
        points={summary.trend.map((r) => ({
          label: formatDate(r.startedAt),
          value: r.meanScore,
          note:
            r.prompt === null
              ? (r.model ?? undefined)
              : `${r.prompt.name} v${String(r.prompt.version)} on ${r.model ?? "?"}`,
        }))}
        format="score"
        max={1}
      />

      <h2>Prompt and model comparison</h2>
      <p className="muted">Most recent run of each combination, newest first.</p>
      <div className="tableWrap">
        <table data-testid="variants-table">
          <thead>
            <tr>
              <th>Prompt</th>
              <th>Model</th>
              <th className="num">Runs</th>
              <th className="num">Pass rate</th>
              <th className="num">Mean score</th>
              <th className="num">Cost</th>
              <th>Last run</th>
            </tr>
          </thead>
          <tbody>
            {variants.map((v) => (
              <tr key={v.key} data-testid="variant-row">
                <td>
                  {v.prompt === null ? "n/a" : `${v.prompt.name} v${String(v.prompt.version)}`}
                </td>
                <td className={styles.mono}>{v.model ?? "n/a"}</td>
                <td className="num">{v.runs}</td>
                <td className="num">{formatPercent(v.latest.passRate)}</td>
                <td className="num">{formatScore(v.latest.meanScore)}</td>
                <td className="num">
                  {v.latest.costUsd === null ? "n/a" : `$${v.latest.costUsd.toFixed(4)}`}
                </td>
                <td>{formatDate(v.latest.startedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Drift</h2>
      {drift === null ? (
        <p className="muted">
          No baseline recorded for the latest run's dataset, prompt and model.
        </p>
      ) : (
        <>
          <p className="muted">
            Against the baseline recorded {formatDate(drift.baseline.recordedAt)} (
            {drift.baseline.prompt === null
              ? "no prompt"
              : `${drift.baseline.prompt.name} v${String(drift.baseline.prompt.version)}`}{" "}
            on {drift.baseline.model ?? "unknown model"}), threshold{" "}
            {formatScore(drift.threshold, 2)}:{" "}
            <span
              className={`${styles.verdict} ${drift.verdict === "REGRESSED" ? styles.verdictRegressed : styles.verdictOk}`}
              data-testid="drift-verdict"
            >
              {drift.verdict}
            </span>
          </p>
          <div className="tableWrap">
            <table data-testid="drift-table">
              <thead>
                <tr>
                  <th>Case</th>
                  <th className="num">Baseline</th>
                  <th className="num">Current</th>
                  <th className="num">Delta</th>
                  <th>Regressed</th>
                </tr>
              </thead>
              <tbody>
                {drift.rows.map((row) => (
                  <tr key={row.name} data-testid="drift-row" data-regressed={row.regressed}>
                    <td>{row.name}</td>
                    <td className="num">{formatScore(row.baselineScore)}</td>
                    <td className="num">{formatScore(row.currentScore)}</td>
                    <td className="num">
                      {row.delta === null ? "n/a" : formatDelta(row.delta, 2)}
                    </td>
                    <td>{row.regressed && <span className="badge critical">regressed</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2>Scores by tag</h2>
      <p className="muted">Latest run, lowest mean score first.</p>
      <div className="tableWrap">
        <table data-testid="tags-table">
          <thead>
            <tr>
              <th>Tag</th>
              <th className="num">Cases</th>
              <th className="num">Passed</th>
              <th className="num">Mean score</th>
            </tr>
          </thead>
          <tbody>
            {tags.map((t) => (
              <tr key={t.tag} data-testid="tag-row">
                <td>{t.tag}</td>
                <td className="num">{t.cases}</td>
                <td className="num">{t.passed}</td>
                <td className="num">{formatScore(t.meanScore)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Latest cases</h2>
      <p className="muted">
        {latest.prompt === null
          ? ""
          : `${latest.prompt.name} v${String(latest.prompt.version)} on `}
        {latest.model ?? "unknown model"}, {formatDate(latest.startedAt)}.
      </p>
      <div className="tableWrap">
        <table data-testid="cases-table">
          <thead>
            <tr>
              <th>Case</th>
              <th>Tags</th>
              <th className="num">Score</th>
              <th>Checks</th>
              <th className="num">Cost</th>
              <th className="num">Latency</th>
            </tr>
          </thead>
          <tbody>
            {latest.cases.map((c) => (
              <tr key={c.name} data-testid="case-row" data-passed={c.passed}>
                <td>
                  <span className={`badge ${c.passed ? "good" : "critical"}`}>
                    {c.passed ? "pass" : "fail"}
                  </span>{" "}
                  {c.name}
                </td>
                <td>
                  <span className={styles.tags}>
                    {c.tags.map((t) => (
                      <span key={t} className={styles.tag}>
                        {t}
                      </span>
                    ))}
                  </span>
                </td>
                <td className="num">{formatScore(c.score)}</td>
                <td>
                  <span className={styles.checks}>
                    {c.checks.map((check, i) => (
                      <span
                        key={`${check.type}-${String(i)}`}
                        className={`badge ${check.passed ? "good" : "critical"}`}
                      >
                        {check.type}
                        {check.score === null ? "" : ` ${formatScore(check.score)}`}
                      </span>
                    ))}
                  </span>
                </td>
                <td className="num">{c.costUsd === null ? "n/a" : `$${c.costUsd.toFixed(4)}`}</td>
                <td className="num">{c.latencyMs === null ? "n/a" : `${String(c.latencyMs)}ms`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
