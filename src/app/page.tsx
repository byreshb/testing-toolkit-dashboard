import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { StatTile } from "@/components/StatTile";
import { readOverview } from "@/data/overview";
import { formatDate, formatPercent, formatScore, pluralise, shortTestId } from "@/lib/format";
import { repoHref } from "@/lib/repo-link";
import { lastDelta } from "@/lib/stats";
import { dashboardContext, type PageSearchParams } from "@/server/context";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function OverviewPage({ searchParams }: { searchParams: PageSearchParams }) {
  const { repo } = await searchParams;
  const context = dashboardContext(repo);
  const overview = readOverview(context.dataDir, context.now);
  const { flake, quarantine, lint, evals } = overview;
  const flakeRates = flake?.trend.map((p) => p.rate) ?? [];
  const lintCounts = lint?.trend.map((p) => p.findings) ?? [];
  const evalScores = evals?.trend.map((p) => p.meanScore) ?? [];
  const expired = quarantine?.entries.filter((e) => e.status === "expired") ?? [];
  const expiring = quarantine?.entries.filter((e) => e.status === "expiring") ?? [];

  return (
    <>
      <h1>Overview</h1>
      <p className="muted">
        Reading <strong>{context.activeRepo.name}</strong> (<code>{context.dataDir}</code>), as of{" "}
        {formatDate(overview.now)}.
      </p>
      <div className={styles.tiles}>
        <StatTile
          testId="tile-flaky"
          label="Flaky tests"
          href={repoHref("/flaky", repo)}
          value={String(flake?.flakyTests ?? 0)}
          detail={
            flake === null
              ? undefined
              : `of ${pluralise(flake.tests, "test")} across ${pluralise(flake.builds, "build")}`
          }
          delta={
            flake === null
              ? undefined
              : {
                  value: lastDelta(flakeRates) * 100,
                  digits: 1,
                  unit: " pts",
                  upIsGood: false,
                  versus: "flaky executions vs the week before",
                }
          }
          trend={
            flake === null
              ? undefined
              : {
                  values: flakeRates,
                  labels: flake.trend.map((p) => `week of ${p.week}`),
                  title: "Share of flaky test executions per week",
                }
          }
          empty={
            flake === null ? (
              <EmptyState tool="flake detector" expected=".flake/history.db" />
            ) : undefined
          }
        />
        <StatTile
          testId="tile-quality"
          label="Test quality findings"
          href={repoHref("/quality", repo)}
          value={String(lint?.latestFindings ?? 0)}
          detail={
            lint === null
              ? undefined
              : `${lint.bySeverity.ERROR} error, ${lint.bySeverity.WARN} warn, ${lint.bySeverity.INFO} info in the latest run`
          }
          delta={
            lint === null
              ? undefined
              : { value: lastDelta(lintCounts), upIsGood: false, versus: "vs the previous run" }
          }
          trend={
            lint === null
              ? undefined
              : {
                  values: lintCounts,
                  labels: lint.trend.map((p) => formatDate(p.startedAt)),
                  title: "Findings per lint run",
                }
          }
          empty={
            lint === null ? (
              <EmptyState tool="test-quality linter" expected="target/tql/*.sarif" />
            ) : undefined
          }
        />
        <StatTile
          testId="tile-evals"
          label="LLM eval score"
          href={repoHref("/evals", repo)}
          value={formatScore(evals?.latestMeanScore)}
          detail={
            evals === null
              ? undefined
              : `pass rate ${formatPercent(evals.latestPassRate ?? 0)}, ${evals.latestPrompt === null ? "" : `${evals.latestPrompt.name} v${String(evals.latestPrompt.version)} on `}${evals.latestModel ?? "unknown model"}`
          }
          delta={
            evals === null
              ? undefined
              : {
                  value: lastDelta(evalScores),
                  digits: 2,
                  upIsGood: true,
                  versus: "vs the previous run",
                }
          }
          trend={
            evals === null
              ? undefined
              : {
                  values: evalScores,
                  labels: evals.trend.map((p) => formatDate(p.startedAt)),
                  title: "Mean score per evaluation run",
                  max: 1,
                }
          }
          empty={
            evals === null ? (
              <EmptyState tool="LLM eval harness" expected="target/llm-eval/*.json" />
            ) : undefined
          }
        />
      </div>
      {(expired.length > 0 || expiring.length > 0) && (
        <section className={`card ${styles.warnings}`} data-testid="quarantine-warnings">
          <h2 style={{ marginTop: 0 }}>Quarantine ledger</h2>
          <ul>
            {expired.map((e) => (
              <li key={e.test}>
                <span className="badge critical">expired</span>{" "}
                <Link href={repoHref(`/flaky/${encodeURIComponent(e.test)}`, repo)}>
                  {shortTestId(e.test)}
                </Link>{" "}
                expired on {e.expires} ({pluralise(-e.daysLeft, "day")} ago), owner{" "}
                {e.owner || "unknown"}.
              </li>
            ))}
            {expiring.map((e) => (
              <li key={e.test}>
                <span className="badge warning">expiring</span>{" "}
                <Link href={repoHref(`/flaky/${encodeURIComponent(e.test)}`, repo)}>
                  {shortTestId(e.test)}
                </Link>{" "}
                expires on {e.expires} (in {pluralise(e.daysLeft, "day")}), owner{" "}
                {e.owner || "unknown"}.
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
