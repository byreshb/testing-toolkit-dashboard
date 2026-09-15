import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { OutcomeLegend, OutcomeStrip } from "@/components/OutcomeStrip";
import { TrendChart } from "@/components/TrendChart";
import { FLAKY_THRESHOLD } from "@/data/flake";
import type { QuarantineEntry } from "@/data/quarantine";
import { formatDate, formatScore, pluralise, shortTestId } from "@/lib/format";
import { repoHref } from "@/lib/repo-link";
import { dashboardContext, type PageSearchParams } from "@/server/context";
import { flakyView } from "@/server/flaky";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<QuarantineEntry["status"], string> = {
  active: "good",
  expiring: "warning",
  expired: "critical",
};

export default async function FlakyPage({ searchParams }: { searchParams: PageSearchParams }) {
  const { repo } = await searchParams;
  const context = dashboardContext(repo);
  const view = flakyView(context);
  if (view === undefined) {
    return (
      <>
        <h1>Flaky tests</h1>
        <EmptyState tool="flake detector" expected=".flake/history.db" />
      </>
    );
  }
  const { scores, summary, quarantine } = view;
  const quarantined = new Map((quarantine?.entries ?? []).map((e) => [e.test, e]));

  return (
    <>
      <h1>Flaky tests</h1>
      <p className={styles.summary}>
        <span>
          <strong>{summary.flakyTests}</strong> flaky of {pluralise(summary.tests, "test")}
        </span>
        <span>
          <strong>{summary.builds}</strong> builds, {summary.executions} executions
        </span>
        <span>latest run {formatDate(summary.latestRunAt)}</span>
      </p>

      <h2>Flaky executions per week</h2>
      <p className="muted">
        Share of test executions that passed only after a retry or flipped against the previous run
        of the same commit.
      </p>
      <TrendChart
        name="Flaky executions"
        points={summary.trend.map((p) => ({
          label: p.week,
          value: p.rate,
          note: `${p.flaky} of ${p.executions} executions`,
        }))}
        format="percent"
      />

      <h2>Ranking</h2>
      <p className="muted">
        Score from rerun recovery, flip rate and failure-message entropy; tests at or above{" "}
        {formatScore(FLAKY_THRESHOLD, 1)} count as flaky. A consistently failing test scores zero:
        that is a regression, not flakiness.
      </p>
      <OutcomeLegend />
      <div className="tableWrap">
        <table data-testid="flaky-table">
          <thead>
            <tr>
              <th className="num">#</th>
              <th>Test</th>
              <th className="num">Score</th>
              <th className="num">Recovered</th>
              <th className="num">Flips</th>
              <th className="num">Runner corr.</th>
              <th>Last</th>
              <th>Recent builds</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((s, index) => {
              const entry = quarantined.get(s.testId);
              return (
                <tr key={s.testId} data-testid="flaky-row">
                  <td className="num">{index + 1}</td>
                  <td>
                    <Link
                      className={styles.test}
                      href={repoHref(`/flaky/${encodeURIComponent(s.testId)}`, repo)}
                    >
                      {shortTestId(s.testId)}
                    </Link>
                    {entry !== undefined && (
                      <>
                        {" "}
                        <span className={`badge ${STATUS_BADGE[entry.status]}`}>
                          quarantine {entry.status}
                        </span>
                      </>
                    )}
                  </td>
                  <td className="num">
                    <span className={styles.score}>{formatScore(s.score)}</span>
                    <br />
                    <span className={styles.interval}>
                      flip {formatScore(s.flipInterval.lower)}–{formatScore(s.flipInterval.upper)}
                    </span>
                  </td>
                  <td className="num">
                    {s.recoveries}/{s.failures}
                  </td>
                  <td className="num">
                    {s.flips}/{s.sameCommitPairs}
                  </td>
                  <td className="num">{formatScore(s.runnerCorrelation)}</td>
                  <td>{s.lastOutcome}</td>
                  <td>
                    <OutcomeStrip history={s.history} limit={24} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2>Quarantine ledger</h2>
      {quarantine === null ? (
        <EmptyState tool="quarantine ledger" expected=".flake/quarantine.yaml" />
      ) : quarantine.entries.length === 0 ? (
        <p className="muted">No quarantined tests.</p>
      ) : (
        <div className="tableWrap">
          <table data-testid="quarantine-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Test</th>
                <th>Reason</th>
                <th>Owner</th>
                <th>Added</th>
                <th>Expires</th>
                <th>Issue</th>
              </tr>
            </thead>
            <tbody>
              {quarantine.entries.map((e) => (
                <tr key={e.test} data-testid="quarantine-row" data-status={e.status}>
                  <td>
                    <span className={`badge ${STATUS_BADGE[e.status]}`}>{e.status}</span>
                  </td>
                  <td>
                    <Link
                      className={styles.test}
                      href={repoHref(`/flaky/${encodeURIComponent(e.test)}`, repo)}
                    >
                      {shortTestId(e.test)}
                    </Link>
                  </td>
                  <td>{e.reason}</td>
                  <td>{e.owner}</td>
                  <td>{e.added}</td>
                  <td>
                    {e.expires}{" "}
                    <span className="muted">
                      {e.daysLeft < 0
                        ? `(${pluralise(-e.daysLeft, "day")} ago)`
                        : `(in ${pluralise(e.daysLeft, "day")})`}
                    </span>
                  </td>
                  <td>
                    {e.issue === undefined ? (
                      ""
                    ) : (
                      <a href={e.issue}>{e.issue.replace(/^https?:\/\//, "")}</a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {quarantine !== null && quarantine.problems.length > 0 && (
        <p className="muted">Ignored entries: {quarantine.problems.join("; ")}.</p>
      )}
    </>
  );
}
