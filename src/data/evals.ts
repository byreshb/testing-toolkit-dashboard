import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { mean, round } from "@/lib/stats";
import { parseInstant } from "@/lib/time";

export interface CheckResult {
  type: string;
  passed: boolean;
  score: number | null;
  threshold: number | null;
}

export interface CaseResult {
  name: string;
  tags: string[];
  passed: boolean;
  score: number;
  checks: CheckResult[];
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number | null;
  costUsd: number | null;
}

export interface PromptRef {
  name: string;
  version: number;
}

export interface DriftRow {
  name: string;
  baselineScore: number | null;
  currentScore: number | null;
  delta: number | null;
  baselinePassed: boolean | null;
  currentPassed: boolean | null;
  regressed: boolean;
}

export interface DriftTable {
  baseline: { prompt: PromptRef | null; model: string | null; recordedAt: string | null };
  threshold: number;
  verdict: "OK" | "REGRESSED";
  rows: DriftRow[];
}

export interface EvalReport {
  source: string;
  startedAt: string;
  commit: string | null;
  dataset: string | null;
  prompt: PromptRef | null;
  model: string | null;
  cases: CaseResult[];
  passRate: number;
  meanScore: number;
  costUsd: number | null;
  meanLatencyMs: number | null;
  /** The harness's own drift table, when the run was compared with a baseline. */
  drift: DriftTable | null;
}

export interface Baseline {
  source: string;
  dataset: string | null;
  prompt: PromptRef | null;
  model: string | null;
  recordedAt: string | null;
  cases: { name: string; passed: boolean; score: number }[];
}

/** A (prompt version, model) combination and its most recent report. */
export interface Variant {
  key: string;
  prompt: PromptRef | null;
  model: string | null;
  latest: EvalReport;
  runs: number;
}

export interface TagScore {
  tag: string;
  cases: number;
  passed: number;
  meanScore: number;
}

export interface EvalSummary {
  runs: number;
  latestRunAt: string | null;
  latestMeanScore: number | null;
  latestPassRate: number | null;
  latestPrompt: PromptRef | null;
  latestModel: string | null;
  /** Mean score per run, oldest first. */
  trend: { startedAt: string; prompt: PromptRef | null; model: string | null; meanScore: number }[];
}

export const DEFAULT_DRIFT_THRESHOLD = 0.1;

/** Reads every report `*.json` in the eval directory (not `baselines/`), oldest first. */
export function readEvalReports(evalDir: string): EvalReport[] {
  return listJsonFiles(evalDir)
    .map((path) => readEvalReport(path))
    .filter((r): r is EvalReport => r !== undefined)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

/** Reads every baseline `*.json` under `baselines/`. */
export function readBaselines(evalDir: string): Baseline[] {
  return listJsonFiles(join(evalDir, "baselines"))
    .map((path) => readBaseline(path))
    .filter((b): b is Baseline => b !== undefined);
}

function listJsonFiles(dir: string): string[] {
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir)
    .sort()
    .map((name) => join(dir, name))
    .filter((path) => path.endsWith(".json") && statSync(path).isFile());
}

export function readEvalReport(path: string): EvalReport | undefined {
  const doc = readJson(path);
  if (doc === undefined || !Array.isArray(doc.cases) || Array.isArray(doc.findings)) {
    return undefined;
  }
  if (!isRecord(doc.summary) && doc.startedAt === undefined) {
    return undefined; // a baseline file, not a report
  }
  return parseEvalReport(doc, basename(path), statSync(path).mtime);
}

export function parseEvalReport(
  doc: Record<string, unknown>,
  source: string,
  fallbackTime: Date,
): EvalReport {
  const cases = asArray(doc.cases)
    .map((c) => parseCase(c))
    .filter((c): c is CaseResult => c !== undefined);
  const summary = isRecord(doc.summary) ? doc.summary : {};
  const costs = cases.map((c) => c.costUsd).filter((c): c is number => c !== null);
  const latencies = cases.map((c) => c.latencyMs).filter((c): c is number => c !== null);
  return {
    source,
    startedAt: (parseInstant(doc.startedAt) ?? fallbackTime).toISOString(),
    commit: typeof doc.commit === "string" ? doc.commit : null,
    dataset: typeof doc.dataset === "string" ? doc.dataset : null,
    prompt: parsePrompt(doc.prompt),
    model: typeof doc.model === "string" ? doc.model : null,
    cases,
    passRate: round(
      typeof summary.passRate === "number"
        ? summary.passRate
        : cases.length === 0
          ? 0
          : cases.filter((c) => c.passed).length / cases.length,
    ),
    meanScore: round(
      typeof summary.meanScore === "number" ? summary.meanScore : mean(cases.map((c) => c.score)),
    ),
    costUsd:
      typeof summary.costUsd === "number"
        ? summary.costUsd
        : costs.length === 0
          ? null
          : round(
              costs.reduce((a, b) => a + b, 0),
              4,
            ),
    meanLatencyMs:
      typeof summary.meanLatencyMs === "number"
        ? summary.meanLatencyMs
        : latencies.length === 0
          ? null
          : Math.round(mean(latencies)),
    drift: parseDrift(doc.drift),
  };
}

function parseCase(value: unknown): CaseResult | undefined {
  if (!isRecord(value) || typeof value.name !== "string") {
    return undefined;
  }
  const checks = asArray(value.checks)
    .filter(isRecord)
    .map((c) => ({
      type: typeof c.type === "string" ? c.type : "check",
      passed: c.passed === true,
      score: numberOrNull(c.score),
      threshold: numberOrNull(c.threshold),
    }));
  const score =
    typeof value.score === "number"
      ? value.score
      : mean(checks.map((c) => c.score).filter((s): s is number => s !== null));
  return {
    name: value.name,
    tags: asArray(value.tags).filter((t): t is string => typeof t === "string"),
    passed: value.passed === true,
    score: round(score),
    checks,
    inputTokens: numberOrNull(value.inputTokens),
    outputTokens: numberOrNull(value.outputTokens),
    latencyMs: numberOrNull(value.latencyMs),
    costUsd: numberOrNull(value.costUsd),
  };
}

function parseDrift(value: unknown): DriftTable | null {
  if (!isRecord(value)) {
    return null;
  }
  const baseline = isRecord(value.baseline) ? value.baseline : {};
  const rows = asArray(value.cases)
    .filter(isRecord)
    .filter((c): c is Record<string, unknown> & { name: string } => typeof c.name === "string")
    .map((c) => ({
      name: c.name,
      baselineScore: numberOrNull(c.baselineScore),
      currentScore: numberOrNull(c.currentScore),
      delta: numberOrNull(c.delta),
      baselinePassed: booleanOrNull(c.baselinePassed),
      currentPassed: booleanOrNull(c.currentPassed),
      regressed: c.regressed === true,
    }));
  return {
    baseline: {
      prompt: parsePrompt(baseline.prompt),
      model: typeof baseline.model === "string" ? baseline.model : null,
      recordedAt: parseInstant(baseline.recordedAt)?.toISOString() ?? null,
    },
    threshold: typeof value.threshold === "number" ? value.threshold : DEFAULT_DRIFT_THRESHOLD,
    verdict: value.verdict === "REGRESSED" || rows.some((r) => r.regressed) ? "REGRESSED" : "OK",
    rows,
  };
}

export function readBaseline(path: string): Baseline | undefined {
  const doc = readJson(path);
  if (doc === undefined || !Array.isArray(doc.cases)) {
    return undefined;
  }
  return {
    source: basename(path),
    dataset: typeof doc.dataset === "string" ? doc.dataset : null,
    prompt: parsePrompt(doc.prompt),
    model: typeof doc.model === "string" ? doc.model : null,
    recordedAt: parseInstant(doc.recordedAt)?.toISOString() ?? null,
    cases: doc.cases
      .filter(isRecord)
      .filter((c): c is Record<string, unknown> & { name: string } => typeof c.name === "string")
      .map((c) => ({
        name: c.name,
        passed: c.passed === true,
        score: typeof c.score === "number" ? c.score : 0,
      })),
  };
}

function parsePrompt(value: unknown): PromptRef | null {
  if (!isRecord(value) || typeof value.name !== "string") {
    return null;
  }
  return { name: value.name, version: typeof value.version === "number" ? value.version : 0 };
}

export function variantKey(prompt: PromptRef | null, model: string | null): string {
  const promptPart = prompt === null ? "prompt?" : `${prompt.name}@v${prompt.version}`;
  return `${promptPart} on ${model ?? "model?"}`;
}

/** The latest report for each (prompt version, model) combination, most recent first. */
export function variants(reports: readonly EvalReport[]): Variant[] {
  const byKey = new Map<string, Variant>();
  for (const report of reports) {
    const key = variantKey(report.prompt, report.model);
    const existing = byKey.get(key);
    if (existing === undefined) {
      byKey.set(key, { key, prompt: report.prompt, model: report.model, latest: report, runs: 1 });
    } else {
      existing.runs++;
      if (report.startedAt >= existing.latest.startedAt) {
        existing.latest = report;
      }
    }
  }
  return [...byKey.values()].sort((a, b) => b.latest.startedAt.localeCompare(a.latest.startedAt));
}

/**
 * Compares two reports case by case: a case regresses when its score drops by more than the
 * threshold or it flips from passed to failed. Cases present in only one report get null on the
 * other side and never count as regressed.
 */
export function compareReports(
  baseline: EvalReport | Baseline,
  current: EvalReport,
  threshold = DEFAULT_DRIFT_THRESHOLD,
): DriftTable {
  const baseCases = new Map(baseline.cases.map((c) => [c.name, c]));
  const names = [...new Set([...baseCases.keys(), ...current.cases.map((c) => c.name)])];
  const rows: DriftRow[] = names.map((name) => {
    const b = baseCases.get(name);
    const c = current.cases.find((x) => x.name === name);
    const delta = b !== undefined && c !== undefined ? round(c.score - b.score) : null;
    return {
      name,
      baselineScore: b?.score ?? null,
      currentScore: c?.score ?? null,
      delta,
      baselinePassed: b?.passed ?? null,
      currentPassed: c?.passed ?? null,
      regressed:
        b !== undefined &&
        c !== undefined &&
        delta !== null &&
        (delta < -threshold || (b.passed && !c.passed)),
    };
  });
  rows.sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0) || a.name.localeCompare(b.name));
  return {
    baseline: {
      prompt: baseline.prompt,
      model: baseline.model,
      recordedAt: "startedAt" in baseline ? baseline.startedAt : baseline.recordedAt,
    },
    threshold,
    verdict: rows.some((r) => r.regressed) ? "REGRESSED" : "OK",
    rows,
  };
}

/** Pass counts and mean score per tag in one report, lowest mean score first. */
export function scoresByTag(report: EvalReport | undefined): TagScore[] {
  if (report === undefined) {
    return [];
  }
  const byTag = new Map<string, { cases: number; passed: number; scores: number[] }>();
  for (const c of report.cases) {
    for (const tag of c.tags.length === 0 ? ["untagged"] : c.tags) {
      const entry = byTag.get(tag) ?? { cases: 0, passed: 0, scores: [] };
      entry.cases++;
      if (c.passed) {
        entry.passed++;
      }
      entry.scores.push(c.score);
      byTag.set(tag, entry);
    }
  }
  return [...byTag.entries()]
    .map(([tag, e]) => ({
      tag,
      cases: e.cases,
      passed: e.passed,
      meanScore: round(mean(e.scores)),
    }))
    .sort((a, b) => a.meanScore - b.meanScore || a.tag.localeCompare(b.tag));
}

export function summariseEvals(reports: readonly EvalReport[]): EvalSummary {
  const latest = reports[reports.length - 1];
  return {
    runs: reports.length,
    latestRunAt: latest?.startedAt ?? null,
    latestMeanScore: latest?.meanScore ?? null,
    latestPassRate: latest?.passRate ?? null,
    latestPrompt: latest?.prompt ?? null,
    latestModel: latest?.model ?? null,
    trend: reports.map((r) => ({
      startedAt: r.startedAt,
      prompt: r.prompt,
      model: r.model,
      meanScore: r.meanScore,
    })),
  };
}

function readJson(path: string): Record<string, unknown> | undefined {
  try {
    const doc: unknown = JSON.parse(readFileSync(path, "utf8"));
    return isRecord(doc) ? doc : undefined;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function booleanOrNull(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}
