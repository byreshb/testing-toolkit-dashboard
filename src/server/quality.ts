import {
  findingsPerRule,
  readLintRuns,
  summariseLint,
  worstFiles,
  type LintRun,
  type LintSummary,
  type RuleSeries,
  type FileCount,
} from "@/data/tql";
import type { DashboardContext } from "./context";

export interface QualityView {
  runs: LintRun[];
  summary: LintSummary;
  rules: RuleSeries[];
  worstFiles: FileCount[];
}

/** Everything the test-quality page and its API return; `undefined` when there are no runs. */
export function qualityView(context: DashboardContext): QualityView | undefined {
  const dir = context.dirs.tql;
  if (dir === undefined) {
    return undefined;
  }
  const runs = readLintRuns(dir);
  if (runs.length === 0) {
    return undefined;
  }
  return {
    runs,
    summary: summariseLint(runs),
    rules: findingsPerRule(runs),
    worstFiles: worstFiles(runs[runs.length - 1]),
  };
}
