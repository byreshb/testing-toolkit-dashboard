import { resolveToolDirs, type ToolDirs } from "./config";
import { readEvalReports, summariseEvals, type EvalSummary } from "./evals";
import { readFlakeHistory, scoreTests, summariseFlakiness, type FlakeSummary } from "./flake";
import { readQuarantine, type QuarantineLedger } from "./quarantine";
import { readLintRuns, summariseLint, type LintSummary } from "./tql";

export interface Overview {
  dataDir: string;
  dirs: ToolDirs;
  now: string;
  flake: FlakeSummary | null;
  quarantine: QuarantineLedger | null;
  lint: LintSummary | null;
  evals: EvalSummary | null;
}

/** Everything the overview page and `/api/overview` show, read fresh from the files. */
export function readOverview(dataDir: string, now: Date): Overview {
  const dirs = resolveToolDirs(dataDir);
  const history = dirs.flake === undefined ? undefined : readFlakeHistory(dirs.flake);
  const lintRuns = dirs.tql === undefined ? [] : readLintRuns(dirs.tql);
  const reports = dirs.llmEval === undefined ? [] : readEvalReports(dirs.llmEval);
  return {
    dataDir,
    dirs,
    now: now.toISOString(),
    flake: history === undefined ? null : summariseFlakiness(history, scoreTests(history), now),
    quarantine: dirs.flake === undefined ? null : (readQuarantine(dirs.flake, now) ?? null),
    lint: lintRuns.length === 0 ? null : summariseLint(lintRuns),
    evals: reports.length === 0 ? null : summariseEvals(reports),
  };
}
