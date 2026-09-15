import {
  compareReports,
  readBaselines,
  readEvalReports,
  scoresByTag,
  summariseEvals,
  variantKey,
  variants,
  type Baseline,
  type DriftTable,
  type EvalReport,
  type EvalSummary,
  type TagScore,
  type Variant,
} from "@/data/evals";
import type { DashboardContext } from "./context";

export interface EvalsView {
  reports: EvalReport[];
  baselines: Baseline[];
  summary: EvalSummary;
  variants: Variant[];
  latest: EvalReport;
  tags: TagScore[];
  /** The latest report's own drift table when present, otherwise computed against the
   * baseline that matches its dataset, prompt and model. */
  drift: DriftTable | null;
}

/** Everything the LLM evals page and its API return; `undefined` when there are no reports. */
export function evalsView(context: DashboardContext): EvalsView | undefined {
  const dir = context.dirs.llmEval;
  if (dir === undefined) {
    return undefined;
  }
  const reports = readEvalReports(dir);
  const latest = reports[reports.length - 1];
  if (latest === undefined) {
    return undefined;
  }
  const baselines = readBaselines(dir);
  const matchingBaseline = baselines.find(
    (b) =>
      b.dataset === latest.dataset &&
      b.model === latest.model &&
      b.prompt?.name === latest.prompt?.name &&
      b.prompt?.version === latest.prompt?.version,
  );
  const drift =
    latest.drift ??
    (matchingBaseline === undefined ? null : compareReports(matchingBaseline, latest));
  return {
    reports,
    baselines,
    summary: summariseEvals(reports),
    variants: variants(reports),
    latest,
    tags: scoresByTag(latest),
    drift,
  };
}

export { variantKey };
