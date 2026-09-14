import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  compareReports,
  parseEvalReport,
  readBaseline,
  readBaselines,
  readEvalReport,
  readEvalReports,
  scoresByTag,
  summariseEvals,
  variantKey,
  variants,
  type EvalReport,
} from "./evals";

const EVAL_DIR = resolve("fixtures/acme-shop/target/llm-eval");
const reports = readEvalReports(EVAL_DIR);
const baselines = readBaselines(EVAL_DIR);

function report(source: string): EvalReport {
  const found = reports.find((r) => r.source === source);
  if (found === undefined) {
    throw new Error(`no report ${source}`);
  }
  return found;
}

describe("readEvalReports", () => {
  it("reads every report oldest first with its summary", () => {
    expect(reports.map((r) => [r.prompt?.version, r.model, r.passRate, r.meanScore])).toEqual([
      [2, "claude-sonnet-5", 0.6, 0.802],
      [3, "claude-sonnet-5", 1, 0.893],
      [3, "claude-sonnet-5", 1, 0.891],
      [4, "claude-sonnet-5", 0.8, 0.867],
      [3, "claude-haiku-4-5-20251001", 0.9, 0.849],
    ]);
    expect(report("report-2026-09-10-support-answer-v3.json")).toMatchObject({
      startedAt: "2026-09-10T08:00:55.000Z",
      commit: "c18",
      dataset: "golden/support-answers.yaml",
      costUsd: 0.031,
      meanLatencyMs: 1067,
    });
  });

  it("reads cases with their checks", () => {
    expect(reports[0]?.cases[0]).toEqual({
      name: "refund-window",
      tags: ["refunds", "policy"],
      passed: true,
      score: 0.84,
      checks: [
        { type: "similarTo", passed: true, score: 0.87, threshold: 0.8 },
        { type: "rubric", passed: true, score: 0.82, threshold: 0.7 },
        { type: "groundedIn", passed: true, score: 0.89, threshold: null },
      ],
      inputTokens: 340,
      outputTokens: 90,
      latencyMs: 900,
      costUsd: 0.002,
    });
  });

  it("keeps the harness's own drift table", () => {
    const v4 = report("report-2026-09-12-support-answer-v4.json");
    expect(v4.drift?.verdict).toBe("REGRESSED");
    expect(v4.drift?.threshold).toBe(0.1);
    expect(v4.drift?.baseline).toEqual({
      prompt: { name: "support-answer", version: 3 },
      model: "claude-sonnet-5",
      recordedAt: "2026-09-01T08:01:40.000Z",
    });
    expect(v4.drift?.rows.filter((r) => r.regressed).map((r) => r.name)).toEqual([
      "delete-account",
      "coupon-stacking",
    ]);
    expect(reports[0]?.drift).toBeNull();
  });

  it("returns nothing for a missing directory and ignores files that are not reports", () => {
    expect(readEvalReports(join(tmpdir(), "does-not-exist"))).toEqual([]);
    expect(readBaselines(join(tmpdir(), "does-not-exist"))).toEqual([]);
    const dir = mkdtempSync(join(tmpdir(), "eval-"));
    writeFileSync(join(dir, "broken.json"), "{");
    writeFileSync(join(dir, "lint.json"), JSON.stringify({ findings: [], cases: [] }));
    writeFileSync(join(dir, "list.json"), "[]");
    writeFileSync(join(dir, "baseline-like.json"), JSON.stringify({ cases: [] }));
    expect(readEvalReports(dir)).toEqual([]);
    expect(readEvalReport(join(dir, "broken.json"))).toBeUndefined();
    expect(readBaseline(join(dir, "broken.json"))).toBeUndefined();
    expect(readBaseline(join(dir, "list.json"))).toBeUndefined();
  });

  it("derives the summary from the cases when the report has none", () => {
    const dir = mkdtempSync(join(tmpdir(), "eval-"));
    const path = join(dir, "r.json");
    writeFileSync(
      path,
      JSON.stringify({
        startedAt: "2026-09-01T00:00:00Z",
        cases: [
          {
            name: "a",
            passed: true,
            checks: [{ score: 0.9 }, { type: "rubric", score: 0.7 }],
            costUsd: 0.01,
            latencyMs: 100,
          },
          { name: "b", passed: false, score: 0.4, latencyMs: 300 },
          "not a case",
        ],
        drift: { cases: [{ name: "a", regressed: false }, "bad"], verdict: "weird" },
      }),
    );
    const run = readEvalReport(path);
    expect(run).toMatchObject({
      prompt: null,
      model: null,
      passRate: 0.5,
      meanScore: 0.6,
      costUsd: 0.01,
      meanLatencyMs: 200,
    });
    expect(run?.cases[0]?.checks[0]?.type).toBe("check");
    expect(run?.drift).toEqual({
      baseline: { prompt: null, model: null, recordedAt: null },
      threshold: 0.1,
      verdict: "OK",
      rows: [
        {
          name: "a",
          baselineScore: null,
          currentScore: null,
          delta: null,
          baselinePassed: null,
          currentPassed: null,
          regressed: false,
        },
      ],
    });
  });

  it("uses the fallback time and empty values for a bare document", () => {
    const run = parseEvalReport({ cases: [] }, "x.json", new Date("2026-02-02T00:00:00Z"));
    expect(run).toMatchObject({
      startedAt: "2026-02-02T00:00:00.000Z",
      passRate: 0,
      meanScore: 0,
      costUsd: null,
      meanLatencyMs: null,
    });
  });
});

describe("readBaselines", () => {
  it("reads the baseline with its cases", () => {
    expect(baselines).toHaveLength(1);
    expect(baselines[0]).toMatchObject({
      source: "support-answers__support-answer-v3__claude-sonnet-5.json",
      prompt: { name: "support-answer", version: 3 },
      model: "claude-sonnet-5",
      recordedAt: "2026-09-01T08:01:40.000Z",
    });
    expect(baselines[0]?.cases[0]).toEqual({ name: "refund-window", passed: true, score: 0.91 });
  });

  it("tolerates baselines with missing fields", () => {
    const dir = mkdtempSync(join(tmpdir(), "eval-"));
    mkdirSync(join(dir, "baselines"));
    writeFileSync(
      join(dir, "baselines", "b.json"),
      JSON.stringify({ cases: [{ name: "a" }, { nope: 1 }], prompt: { version: 1 } }),
    );
    expect(readBaselines(dir)[0]).toEqual({
      source: "b.json",
      dataset: null,
      prompt: null,
      model: null,
      recordedAt: null,
      cases: [{ name: "a", passed: false, score: 0 }],
    });
  });
});

describe("variants", () => {
  it("keeps the latest report per prompt version and model, newest first", () => {
    expect(variants(reports).map((v) => [v.key, v.runs, v.latest.source])).toEqual([
      [
        "support-answer@v3 on claude-haiku-4-5-20251001",
        1,
        "report-2026-09-12-support-answer-v3-haiku.json",
      ],
      ["support-answer@v4 on claude-sonnet-5", 1, "report-2026-09-12-support-answer-v4.json"],
      ["support-answer@v3 on claude-sonnet-5", 2, "report-2026-09-10-support-answer-v3.json"],
      ["support-answer@v2 on claude-sonnet-5", 1, "report-2026-08-15-support-answer-v2.json"],
    ]);
    expect(variantKey(null, null)).toBe("prompt? on model?");
  });
});

describe("compareReports", () => {
  it("finds the cases that regressed between the baseline and prompt v4", () => {
    const baseline = baselines[0];
    if (baseline === undefined) {
      throw new Error("no baseline");
    }
    const drift = compareReports(baseline, report("report-2026-09-12-support-answer-v4.json"));
    expect(drift.verdict).toBe("REGRESSED");
    expect(drift.baseline.recordedAt).toBe("2026-09-01T08:01:40.000Z");
    expect(drift.rows.slice(0, 2)).toEqual([
      {
        name: "delete-account",
        baselineScore: 0.88,
        currentScore: 0.66,
        delta: -0.22,
        baselinePassed: true,
        currentPassed: false,
        regressed: true,
      },
      {
        name: "coupon-stacking",
        baselineScore: 0.85,
        currentScore: 0.71,
        delta: -0.14,
        baselinePassed: true,
        currentPassed: false,
        regressed: true,
      },
    ]);
    expect(drift.rows.filter((r) => r.regressed)).toHaveLength(2);
  });

  it("compares two reports, honours the threshold and handles cases on one side only", () => {
    const v3 = report("report-2026-09-10-support-answer-v3.json");
    const haiku = report("report-2026-09-12-support-answer-v3-haiku.json");
    const byDefault = compareReports(v3, haiku);
    expect(byDefault.verdict).toBe("REGRESSED");
    expect(byDefault.rows.filter((r) => r.regressed).map((r) => r.name)).toEqual([
      "shipping-lost-parcel",
    ]);
    expect(byDefault.rows[0]).toMatchObject({
      delta: -0.07,
      baselinePassed: true,
      currentPassed: false,
    });
    expect(
      compareReports(v3, haiku, 0.05)
        .rows.filter((r) => r.regressed)
        .map((r) => r.name),
    ).toEqual(["shipping-lost-parcel", "coupon-stacking"]);
    expect(compareReports(v3, haiku).baseline.recordedAt).toBe(v3.startedAt);

    const partial: EvalReport = { ...haiku, cases: haiku.cases.slice(0, 1) };
    const extra: EvalReport = {
      ...v3,
      cases: [...v3.cases.slice(0, 1), { ...v3.cases[1]!, name: "brand-new" }],
    };
    const rows = compareReports(partial, extra).rows;
    expect(rows.find((r) => r.name === "brand-new")).toMatchObject({
      baselineScore: null,
      delta: null,
      regressed: false,
    });
  });
});

describe("scoresByTag and summariseEvals", () => {
  it("aggregates per tag, lowest score first", () => {
    const tags = scoresByTag(report("report-2026-09-12-support-answer-v4.json"));
    expect(tags[0]).toEqual({ tag: "promotions", cases: 1, passed: 0, meanScore: 0.71 });
    expect(tags.find((t) => t.tag === "policy")).toEqual({
      tag: "policy",
      cases: 4,
      passed: 2,
      meanScore: 0.793,
    });
    expect(scoresByTag(undefined)).toEqual([]);
    const untagged = parseEvalReport(
      { cases: [{ name: "a", score: 0.5, passed: true }] },
      "x",
      new Date(),
    );
    expect(scoresByTag(untagged)).toEqual([
      { tag: "untagged", cases: 1, passed: 1, meanScore: 0.5 },
    ]);
  });

  it("summarises the latest run and the score trend", () => {
    const summary = summariseEvals(reports);
    expect(summary).toMatchObject({
      runs: 5,
      latestRunAt: "2026-09-12T08:20:33.000Z",
      latestMeanScore: 0.849,
      latestPassRate: 0.9,
      latestPrompt: { name: "support-answer", version: 3 },
      latestModel: "claude-haiku-4-5-20251001",
    });
    expect(summary.trend.map((t) => t.meanScore)).toEqual([0.802, 0.893, 0.891, 0.867, 0.849]);
    expect(summariseEvals([]).latestMeanScore).toBeNull();
  });
});
