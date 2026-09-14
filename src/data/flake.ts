import Database from "better-sqlite3";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  clamp,
  cramersV,
  normalisedEntropy,
  round,
  wilsonInterval,
  type Interval,
} from "@/lib/stats";
import { recentWeeks, weekStart } from "@/lib/time";

export type Outcome = "PASS" | "FAIL" | "ERROR" | "SKIPPED";

export interface BuildRun {
  id: number;
  workflowRunId: string;
  attempt: number;
  commit: string;
  branch: string;
  timestamp: string;
}

export interface TestRun {
  id: number;
  buildRunId: number;
  testId: string;
  className: string;
  methodName: string;
  timestamp: string;
  commit: string;
  branch: string;
  runner: string | null;
  durationMs: number;
  outcome: Outcome;
  failureHash: string | null;
}

export interface FlakeHistory {
  builds: BuildRun[];
  runs: TestRun[];
}

/** One test's executions inside one build, in order; several rows when Surefire reran it. */
export interface BuildExecution {
  buildId: number;
  timestamp: string;
  commit: string;
  attempt: number;
  runner: string | null;
  outcomes: Outcome[];
  final: Outcome;
  /** Mixed outcomes on the same commit, either inside this build or against the previous one. */
  flaky: boolean;
}

export interface ScoreComponent {
  name: string;
  value: number;
  weight: number;
  contribution: number;
  note: string;
}

export interface FlakeScore {
  testId: string;
  className: string;
  methodName: string;
  executions: number;
  runs: number;
  passes: number;
  failures: number;
  skipped: number;
  flips: number;
  sameCommitPairs: number;
  flipRate: number;
  flipInterval: Interval;
  recoveries: number;
  rerunRecoveryRate: number;
  recoveryInterval: Interval;
  distinctFailures: number;
  failureMessageEntropy: number;
  runnerCorrelation: number;
  score: number;
  components: ScoreComponent[];
  firstRunAt: string;
  lastRunAt: string;
  lastOutcome: Outcome;
  history: BuildExecution[];
}

export interface WeekPoint {
  week: string;
  executions: number;
  flaky: number;
  rate: number;
}

export interface FlakeSummary {
  tests: number;
  flakyTests: number;
  builds: number;
  executions: number;
  latestRunAt: string | null;
  trend: WeekPoint[];
}

/** Tests scoring at or above this are counted as flaky in summaries. */
export const FLAKY_THRESHOLD = 0.2;

const WEIGHTS = { rerunRecovery: 0.5, flipRate: 0.3, entropy: 0.2 } as const;

interface BuildRow {
  id: number;
  workflow_run_id: string;
  attempt: number;
  commit_sha: string;
  branch: string;
  timestamp: string;
}

interface TestRow {
  id: number;
  build_run_id: number;
  class_name: string;
  method_name: string;
  timestamp: string;
  commit_sha: string;
  branch: string;
  runner: string | null;
  duration_ms: number;
  outcome: Outcome;
  failure_hash: string | null;
}

export function testId(className: string, methodName: string): string {
  return `${className}#${methodName}`;
}

/** Reads `history.db` from a flake directory; `undefined` when the file is absent. */
export function readFlakeHistory(flakeDir: string): FlakeHistory | undefined {
  const path = join(flakeDir, "history.db");
  if (!existsSync(path)) {
    return undefined;
  }
  const db = new Database(path, { readonly: true, fileMustExist: true });
  try {
    const builds = db
      .prepare<[], BuildRow>("SELECT * FROM build_run ORDER BY timestamp, id")
      .all()
      .map((r) => ({
        id: r.id,
        workflowRunId: r.workflow_run_id,
        attempt: r.attempt,
        commit: r.commit_sha,
        branch: r.branch,
        timestamp: r.timestamp,
      }));
    const runs = db
      .prepare<[], TestRow>("SELECT * FROM test_run ORDER BY timestamp, id")
      .all()
      .map((r) => ({
        id: r.id,
        buildRunId: r.build_run_id,
        testId: testId(r.class_name, r.method_name),
        className: r.class_name,
        methodName: r.method_name,
        timestamp: r.timestamp,
        commit: r.commit_sha,
        branch: r.branch,
        runner: r.runner,
        durationMs: r.duration_ms,
        outcome: r.outcome,
        failureHash: r.failure_hash,
      }));
    return { builds, runs };
  } finally {
    db.close();
  }
}

/** Groups a test's runs into one execution per build, in build order. */
export function executionsOf(history: FlakeHistory, runs: readonly TestRun[]): BuildExecution[] {
  const byBuild = new Map<number, TestRun[]>();
  for (const run of runs) {
    const list = byBuild.get(run.buildRunId) ?? [];
    list.push(run);
    byBuild.set(run.buildRunId, list);
  }
  const executions: BuildExecution[] = [];
  const lastFinalByCommit = new Map<string, Outcome>();
  for (const build of history.builds) {
    const list = byBuild.get(build.id);
    if (list === undefined) {
      continue;
    }
    const outcomes = list.map((r) => r.outcome);
    const final = outcomes[outcomes.length - 1] ?? "SKIPPED";
    const decided = outcomes.filter((o) => o !== "SKIPPED");
    const mixedInside = new Set(decided).size > 1;
    const previous = lastFinalByCommit.get(build.commit);
    const flippedAgainstPrevious =
      previous !== undefined && previous !== "SKIPPED" && final !== "SKIPPED" && previous !== final;
    executions.push({
      buildId: build.id,
      timestamp: build.timestamp,
      commit: build.commit,
      attempt: build.attempt,
      runner: list[0]?.runner ?? null,
      outcomes,
      final,
      flaky: mixedInside || flippedAgainstPrevious,
    });
    if (final !== "SKIPPED") {
      lastFinalByCommit.set(build.commit, final);
    }
  }
  return executions;
}

/** Scores every test in the history and returns them ranked, most flaky first. */
export function scoreTests(history: FlakeHistory): FlakeScore[] {
  const byTest = new Map<string, TestRun[]>();
  for (const run of history.runs) {
    const list = byTest.get(run.testId) ?? [];
    list.push(run);
    byTest.set(run.testId, list);
  }
  const scores: FlakeScore[] = [];
  for (const runs of byTest.values()) {
    scores.push(scoreTest(history, runs));
  }
  return scores.sort(
    (a, b) => b.score - a.score || b.failures - a.failures || a.testId.localeCompare(b.testId),
  );
}

function scoreTest(history: FlakeHistory, runs: readonly TestRun[]): FlakeScore {
  const first = runs[0];
  if (first === undefined) {
    throw new Error("a test needs at least one run");
  }
  const decided = runs.filter((r) => r.outcome !== "SKIPPED");
  const failures = decided.filter((r) => r.outcome !== "PASS");

  // Same-commit sequences: adjacent pairs, flips and rerun recoveries.
  const byCommit = new Map<string, TestRun[]>();
  for (const run of decided) {
    const list = byCommit.get(run.commit) ?? [];
    list.push(run);
    byCommit.set(run.commit, list);
  }
  let pairs = 0;
  let flips = 0;
  let recoveries = 0;
  for (const sequence of byCommit.values()) {
    for (let i = 1; i < sequence.length; i++) {
      const previous = sequence[i - 1];
      const current = sequence[i];
      if (previous === undefined || current === undefined) {
        continue;
      }
      pairs++;
      if (previous.outcome !== current.outcome) {
        flips++;
      }
      if (previous.outcome !== "PASS" && current.outcome === "PASS") {
        recoveries++;
      }
    }
  }
  const flipRate = pairs === 0 ? 0 : flips / pairs;
  const flipInterval = wilsonInterval(flips, pairs);
  const rerunRecoveryRate = failures.length === 0 ? 0 : recoveries / failures.length;
  const recoveryInterval = wilsonInterval(recoveries, failures.length);

  const hashCounts = new Map<string, number>();
  for (const f of failures) {
    const key = f.failureHash ?? "";
    hashCounts.set(key, (hashCounts.get(key) ?? 0) + 1);
  }
  const failureMessageEntropy = normalisedEntropy([...hashCounts.values()]);

  const history_ = executionsOf(history, runs);
  const runnerCorrelation = runnerAssociation(history_);

  const components: ScoreComponent[] = [
    {
      name: "Rerun recovery rate (Wilson lower bound)",
      value: round(recoveryInterval.lower),
      weight: WEIGHTS.rerunRecovery,
      contribution: round(WEIGHTS.rerunRecovery * recoveryInterval.lower),
      note: `${recoveries} of ${failures.length} failures passed on a retry of the same commit (rate ${round(rerunRecoveryRate, 2)})`,
    },
    {
      name: "Flip rate (Wilson lower bound)",
      value: round(flipInterval.lower),
      weight: WEIGHTS.flipRate,
      contribution: round(WEIGHTS.flipRate * flipInterval.lower),
      note: `${flips} flips in ${pairs} consecutive same-commit runs (rate ${round(flipRate, 2)})`,
    },
    {
      name: "Failure message entropy",
      value: round(failureMessageEntropy),
      weight: WEIGHTS.entropy,
      contribution: round(WEIGHTS.entropy * failureMessageEntropy),
      note: `${hashCounts.size} distinct failure messages across ${failures.length} failures`,
    },
  ];
  const score = clamp(
    components.reduce((sum, c) => sum + c.contribution, 0),
    0,
    1,
  );
  const last = runs[runs.length - 1] ?? first;
  return {
    testId: first.testId,
    className: first.className,
    methodName: first.methodName,
    executions: history_.length,
    runs: runs.length,
    passes: decided.length - failures.length,
    failures: failures.length,
    skipped: runs.length - decided.length,
    flips,
    sameCommitPairs: pairs,
    flipRate: round(flipRate),
    flipInterval: { lower: round(flipInterval.lower), upper: round(flipInterval.upper) },
    recoveries,
    rerunRecoveryRate: round(rerunRecoveryRate),
    recoveryInterval: {
      lower: round(recoveryInterval.lower),
      upper: round(recoveryInterval.upper),
    },
    distinctFailures: hashCounts.size,
    failureMessageEntropy: round(failureMessageEntropy),
    runnerCorrelation: round(runnerCorrelation),
    score: round(score),
    components,
    firstRunAt: first.timestamp,
    lastRunAt: last.timestamp,
    lastOutcome: last.outcome,
    history: history_,
  };
}

/** Cramér's V between the runner label and the final outcome of each execution. */
function runnerAssociation(executions: readonly BuildExecution[]): number {
  const runners = [...new Set(executions.map((e) => e.runner ?? "unknown"))];
  if (runners.length < 2) {
    return 0;
  }
  const table = runners.map((runner) => {
    let pass = 0;
    let fail = 0;
    for (const e of executions) {
      if ((e.runner ?? "unknown") !== runner || e.final === "SKIPPED") {
        continue;
      }
      if (e.final === "PASS") {
        pass++;
      } else {
        fail++;
      }
    }
    return [pass, fail];
  });
  return cramersV(table);
}

/** Share of test executions per week that were flaky, for the last `weeks` weeks up to `now`. */
export function flakinessTrend(scores: readonly FlakeScore[], now: Date, weeks = 8): WeekPoint[] {
  const points = new Map<string, WeekPoint>();
  for (const week of recentWeeks(now, weeks)) {
    points.set(week, { week, executions: 0, flaky: 0, rate: 0 });
  }
  for (const score of scores) {
    for (const execution of score.history) {
      if (execution.final === "SKIPPED") {
        continue;
      }
      const point = points.get(weekStart(new Date(execution.timestamp)));
      if (point === undefined) {
        continue;
      }
      point.executions++;
      if (execution.flaky) {
        point.flaky++;
      }
    }
  }
  return [...points.values()].map((p) => ({
    ...p,
    rate: p.executions === 0 ? 0 : round(p.flaky / p.executions),
  }));
}

export function summariseFlakiness(
  history: FlakeHistory,
  scores: readonly FlakeScore[],
  now: Date,
): FlakeSummary {
  const lastBuild = history.builds[history.builds.length - 1];
  return {
    tests: scores.length,
    flakyTests: scores.filter((s) => s.score >= FLAKY_THRESHOLD).length,
    builds: history.builds.length,
    executions: scores.reduce((sum, s) => sum + s.executions, 0),
    latestRunAt: lastBuild?.timestamp ?? null,
    trend: flakinessTrend(scores, now),
  };
}
