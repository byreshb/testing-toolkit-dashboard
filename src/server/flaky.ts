import {
  readFlakeHistory,
  scoreTests,
  summariseFlakiness,
  type FlakeHistory,
  type FlakeScore,
  type FlakeSummary,
} from "@/data/flake";
import { readQuarantine, type QuarantineLedger } from "@/data/quarantine";
import type { DashboardContext } from "./context";

export interface FlakyView {
  history: FlakeHistory;
  scores: FlakeScore[];
  summary: FlakeSummary;
  quarantine: QuarantineLedger | null;
}

/** Everything the flaky-tests page and its API return; `undefined` when there is no history. */
export function flakyView(context: DashboardContext): FlakyView | undefined {
  const dir = context.dirs.flake;
  if (dir === undefined) {
    return undefined;
  }
  const history = readFlakeHistory(dir);
  if (history === undefined) {
    return undefined;
  }
  const scores = scoreTests(history);
  return {
    history,
    scores,
    summary: summariseFlakiness(history, scores, context.now),
    quarantine: readQuarantine(dir, context.now) ?? null,
  };
}
