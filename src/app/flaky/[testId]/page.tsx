import Link from "next/link";
import { notFound } from "next/navigation";
import { OutcomeLegend, OutcomeStrip } from "@/components/OutcomeStrip";
import { formatDateTime, formatScore, pluralise } from "@/lib/format";
import { repoHref } from "@/lib/repo-link";
import { dashboardContext, type PageSearchParams } from "@/server/context";
import { flakyView } from "@/server/flaky";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function TestPage({
  params,
  searchParams,
}: {
  params: Promise<{ testId: string }>;
  searchParams: PageSearchParams;
}) {
  const [{ testId }, { repo }] = await Promise.all([params, searchParams]);
  const id = decodeURIComponent(testId);
  const view = flakyView(dashboardContext(repo));
  const score = view?.scores.find((s) => s.testId === id);
  if (view === undefined || score === undefined) {
    notFound();
  }
  const entry = view.quarantine?.entries.find((e) => e.test === id);
  const rank = view.scores.indexOf(score) + 1;

  return (
    <>
      <p>
        <Link href={repoHref("/flaky", repo)}>← Flaky tests</Link>
      </p>
      <h1>
        <code>{score.className}</code>
        <br />
        <code>#{score.methodName}</code>
      </h1>
      <p className="muted">
        Rank {rank} of {view.scores.length}. First seen {formatDateTime(score.firstRunAt)}, last run{" "}
        {formatDateTime(score.lastRunAt)} ({score.lastOutcome}).
      </p>
      {entry !== undefined && (
        <p data-testid="quarantine-entry">
          <span
            className={`badge ${entry.status === "expired" ? "critical" : entry.status === "expiring" ? "warning" : "good"}`}
          >
            quarantine {entry.status}
          </span>{" "}
          {entry.reason} (owner {entry.owner || "unknown"}, added {entry.added}, expires{" "}
          {entry.expires}
          {entry.issue === undefined ? "" : ", "}
          {entry.issue !== undefined && <a href={entry.issue}>issue</a>}).
        </p>
      )}

      <div className={styles.facts}>
        <Fact label="Score" value={formatScore(score.score)} testId="score" />
        <Fact label="Executions" value={String(score.executions)} />
        <Fact label="Failures" value={`${score.failures} of ${score.runs} runs`} />
        <Fact label="Recovered on retry" value={`${score.recoveries} of ${score.failures}`} />
        <Fact label="Flips" value={`${score.flips} of ${score.sameCommitPairs} pairs`} />
        <Fact label="Runner correlation" value={formatScore(score.runnerCorrelation)} />
      </div>

      <h2>Why this score</h2>
      <div className="tableWrap">
        <table data-testid="components-table">
          <thead>
            <tr>
              <th>Component</th>
              <th className="num">Value</th>
              <th className="num">Weight</th>
              <th className="num">Contribution</th>
              <th>Evidence</th>
            </tr>
          </thead>
          <tbody>
            {score.components.map((c) => (
              <tr key={c.name}>
                <td>{c.name}</td>
                <td className="num">{formatScore(c.value)}</td>
                <td className="num">{formatScore(c.weight, 1)}</td>
                <td className="num">{formatScore(c.contribution)}</td>
                <td>{c.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">
        Flip rate {formatScore(score.flipRate)} with a 95% interval of{" "}
        {formatScore(score.flipInterval.lower)}–{formatScore(score.flipInterval.upper)};{" "}
        {pluralise(score.distinctFailures, "distinct failure message")}.
      </p>

      <h2>History</h2>
      <OutcomeLegend />
      <OutcomeStrip history={score.history} limit={120} />
      <div className="tableWrap">
        <table data-testid="history-table">
          <thead>
            <tr>
              <th>Build</th>
              <th>Commit</th>
              <th className="num">Attempt</th>
              <th>Runner</th>
              <th>Outcomes</th>
            </tr>
          </thead>
          <tbody>
            {[...score.history].reverse().map((e) => (
              <tr key={e.buildId}>
                <td>{formatDateTime(e.timestamp)}</td>
                <td>
                  <code>{e.commit}</code>
                </td>
                <td className="num">{e.attempt}</td>
                <td>{e.runner ?? ""}</td>
                <td className={styles.outcomes}>{e.outcomes.join(" → ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Fact({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className={`card ${styles.fact}`}>
      <div className={styles.factLabel}>{label}</div>
      <div
        className={styles.factValue}
        data-testid={testId === undefined ? undefined : `fact-${testId}`}
      >
        {value}
      </div>
    </div>
  );
}
