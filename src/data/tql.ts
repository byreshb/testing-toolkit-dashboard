import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { parseInstant } from "@/lib/time";

export type Severity = "ERROR" | "WARN" | "INFO";

export interface Finding {
  ruleId: string;
  rule: string;
  severity: Severity;
  file: string;
  line: number;
  column: number;
  message: string;
  fixHint?: string;
}

export interface LintRun {
  /** File name the run was read from. */
  source: string;
  startedAt: string;
  commit: string | null;
  branch: string | null;
  toolVersion: string | null;
  filesScanned: number | null;
  findings: Finding[];
  /** Rule names from the SARIF driver or the JSON `rule` fields. */
  rules: Record<string, string>;
}

export interface RuleSeries {
  ruleId: string;
  rule: string;
  severity: Severity;
  counts: number[];
  latest: number;
}

export interface FileCount {
  file: string;
  count: number;
  bySeverity: Record<Severity, number>;
}

export interface LintSummary {
  runs: number;
  latestRunAt: string | null;
  latestFindings: number;
  bySeverity: Record<Severity, number>;
  /** Finding totals per run, oldest first. */
  trend: { startedAt: string; commit: string | null; findings: number }[];
}

const SEVERITY_ORDER: Severity[] = ["ERROR", "WARN", "INFO"];

/** Reads every `*.sarif` and `*.json` report in a directory, oldest run first. */
export function readLintRuns(tqlDir: string): LintRun[] {
  if (!existsSync(tqlDir)) {
    return [];
  }
  const runs: LintRun[] = [];
  for (const name of readdirSync(tqlDir).sort()) {
    const path = join(tqlDir, name);
    if (!statSync(path).isFile()) {
      continue;
    }
    const run = readLintRun(path);
    if (run !== undefined) {
      runs.push(run);
    }
  }
  return runs.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

/** Parses one report file; `undefined` for files that are not SARIF or linter JSON. */
export function readLintRun(path: string): LintRun | undefined {
  if (!path.endsWith(".sarif") && !path.endsWith(".json")) {
    return undefined;
  }
  let doc: unknown;
  try {
    doc = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return undefined;
  }
  const fallbackTime = statSync(path).mtime.toISOString();
  const run = isRecord(doc) ? parseLintDocument(doc, basename(path), fallbackTime) : undefined;
  return run;
}

export function parseLintDocument(
  doc: Record<string, unknown>,
  source: string,
  fallbackTime: string,
): LintRun | undefined {
  if (Array.isArray(doc.runs)) {
    return parseSarif(doc, source, fallbackTime);
  }
  if (Array.isArray(doc.findings)) {
    return parseJsonReport(doc, source, fallbackTime);
  }
  return undefined;
}

function parseSarif(
  doc: Record<string, unknown>,
  source: string,
  fallbackTime: string,
): LintRun | undefined {
  const run = (doc.runs as unknown[])[0];
  if (!isRecord(run)) {
    return undefined;
  }
  const driver = pick(pick(run, "tool"), "driver");
  const rules: Record<string, string> = {};
  const defaultLevels: Record<string, Severity> = {};
  for (const rule of asArray(driver?.rules)) {
    if (!isRecord(rule) || typeof rule.id !== "string") {
      continue;
    }
    rules[rule.id] = typeof rule.name === "string" ? rule.name : rule.id;
    const level = pick(rule, "defaultConfiguration")?.level;
    if (typeof level === "string") {
      defaultLevels[rule.id] = severityFromSarifLevel(level);
    }
  }
  const invocation = asArray(run.invocations)[0];
  const provenance = asArray(run.versionControlProvenance)[0];
  const properties = pick(run, "properties");
  const findings: Finding[] = [];
  for (const result of asArray(run.results)) {
    if (!isRecord(result) || typeof result.ruleId !== "string") {
      continue;
    }
    const location = pick(asArray(result.locations)[0], "physicalLocation");
    const region = pick(location, "region");
    const resultProperties = pick(result, "properties");
    const fixHint = resultProperties?.fixHint;
    findings.push({
      ruleId: result.ruleId,
      rule: rules[result.ruleId] ?? result.ruleId,
      severity:
        typeof result.level === "string"
          ? severityFromSarifLevel(result.level)
          : (defaultLevels[result.ruleId] ?? "WARN"),
      file: stringOr(pick(location, "artifactLocation")?.uri, ""),
      line: numberOr(region?.startLine, 0),
      column: numberOr(region?.startColumn, 0),
      message: stringOr(pick(result, "message")?.text, ""),
      ...(typeof fixHint === "string" ? { fixHint } : {}),
    });
  }
  const startedAt = parseInstant(
    invocation && isRecord(invocation) ? invocation.startTimeUtc : undefined,
  );
  const revision = provenance && isRecord(provenance) ? provenance.revisionId : undefined;
  const branch = provenance && isRecord(provenance) ? provenance.branch : undefined;
  return {
    source,
    startedAt: (startedAt ?? new Date(fallbackTime)).toISOString(),
    commit: typeof revision === "string" ? revision : null,
    branch: typeof branch === "string" ? branch : null,
    toolVersion: typeof driver?.version === "string" ? driver.version : null,
    filesScanned: typeof properties?.filesScanned === "number" ? properties.filesScanned : null,
    findings,
    rules,
  };
}

function parseJsonReport(
  doc: Record<string, unknown>,
  source: string,
  fallbackTime: string,
): LintRun {
  const rules: Record<string, string> = {};
  const findings: Finding[] = [];
  for (const item of doc.findings as unknown[]) {
    if (!isRecord(item) || typeof item.ruleId !== "string") {
      continue;
    }
    const rule = typeof item.rule === "string" ? item.rule : item.ruleId;
    rules[item.ruleId] = rule;
    findings.push({
      ruleId: item.ruleId,
      rule,
      severity: severityFromName(item.severity),
      file: stringOr(item.file, ""),
      line: numberOr(item.line, 0),
      column: numberOr(item.column, 0),
      message: stringOr(item.message, ""),
      ...(typeof item.fixHint === "string" ? { fixHint: item.fixHint } : {}),
    });
  }
  const startedAt = parseInstant(doc.startedAt) ?? new Date(fallbackTime);
  return {
    source,
    startedAt: startedAt.toISOString(),
    commit: typeof doc.commit === "string" ? doc.commit : null,
    branch: typeof doc.branch === "string" ? doc.branch : null,
    toolVersion: typeof doc.version === "string" ? doc.version : null,
    filesScanned: typeof doc.filesScanned === "number" ? doc.filesScanned : null,
    findings,
    rules,
  };
}

export function severityFromSarifLevel(level: string): Severity {
  switch (level) {
    case "error":
      return "ERROR";
    case "note":
      return "INFO";
    default:
      return "WARN";
  }
}

function severityFromName(value: unknown): Severity {
  return value === "ERROR" || value === "INFO" ? value : "WARN";
}

/** Findings per rule across runs (one count per run, oldest first), worst rule first. */
export function findingsPerRule(runs: readonly LintRun[]): RuleSeries[] {
  const series = new Map<string, RuleSeries>();
  runs.forEach((run, index) => {
    for (const finding of run.findings) {
      let entry = series.get(finding.ruleId);
      if (entry === undefined) {
        entry = {
          ruleId: finding.ruleId,
          rule: finding.rule,
          severity: finding.severity,
          counts: new Array<number>(runs.length).fill(0),
          latest: 0,
        };
        series.set(finding.ruleId, entry);
      }
      entry.counts[index] = (entry.counts[index] ?? 0) + 1;
    }
  });
  return [...series.values()]
    .map((s) => ({ ...s, latest: s.counts[s.counts.length - 1] ?? 0 }))
    .sort(
      (a, b) =>
        b.latest - a.latest ||
        SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) ||
        a.ruleId.localeCompare(b.ruleId),
    );
}

/** Files with the most findings in one run, worst first. */
export function worstFiles(run: LintRun | undefined, limit = 10): FileCount[] {
  if (run === undefined) {
    return [];
  }
  const byFile = new Map<string, FileCount>();
  for (const finding of run.findings) {
    let entry = byFile.get(finding.file);
    if (entry === undefined) {
      entry = { file: finding.file, count: 0, bySeverity: { ERROR: 0, WARN: 0, INFO: 0 } };
      byFile.set(finding.file, entry);
    }
    entry.count++;
    entry.bySeverity[finding.severity]++;
  }
  return [...byFile.values()]
    .sort((a, b) => b.count - a.count || a.file.localeCompare(b.file))
    .slice(0, limit);
}

export function summariseLint(runs: readonly LintRun[]): LintSummary {
  const latest = runs[runs.length - 1];
  const bySeverity: Record<Severity, number> = { ERROR: 0, WARN: 0, INFO: 0 };
  for (const finding of latest?.findings ?? []) {
    bySeverity[finding.severity]++;
  }
  return {
    runs: runs.length,
    latestRunAt: latest?.startedAt ?? null,
    latestFindings: latest?.findings.length ?? 0,
    bySeverity,
    trend: runs.map((r) => ({
      startedAt: r.startedAt,
      commit: r.commit,
      findings: r.findings.length,
    })),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pick(value: unknown, key: string): Record<string, unknown> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const inner = value[key];
  return isRecord(inner) ? inner : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" ? value : fallback;
}
