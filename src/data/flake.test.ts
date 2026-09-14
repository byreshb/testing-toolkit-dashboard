import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  executionsOf,
  flakinessTrend,
  FLAKY_THRESHOLD,
  readFlakeHistory,
  scoreTests,
  summariseFlakiness,
  testId,
  type FlakeHistory,
  type FlakeScore,
} from "./flake";

const FLAKE_DIR = resolve("fixtures/acme-shop/.flake");
const NOW = new Date("2026-09-13T12:00:00Z");

let history: FlakeHistory;
let scores: FlakeScore[];

beforeAll(() => {
  const read = readFlakeHistory(FLAKE_DIR);
  if (read === undefined) {
    throw new Error("fixture history.db is missing; run `npm run fixtures`");
  }
  history = read;
  scores = scoreTests(history);
});

function score(id: string): FlakeScore {
  const found = scores.find((s) => s.testId === id);
  if (found === undefined) {
    throw new Error(`no score for ${id}`);
  }
  return found;
}

describe("readFlakeHistory", () => {
  it("returns undefined when there is no history.db", () => {
    expect(readFlakeHistory(mkdtempSync(join(tmpdir(), "flake-")))).toBeUndefined();
  });

  it("reads builds and runs in time order", () => {
    expect(history.builds).toHaveLength(24);
    expect(history.runs).toHaveLength(211);
    expect(history.builds[0]).toEqual({
      id: 1,
      workflowRunId: "1000",
      attempt: 1,
      commit: "c01",
      branch: "main",
      timestamp: "2026-07-15T09:00:00Z",
    });
    expect(history.runs[0]).toMatchObject({
      buildRunId: 1,
      testId: "com.acme.shop.CheckoutTest#appliesCoupon",
      outcome: "PASS",
      failureHash: null,
      runner: "ubuntu-latest",
      durationMs: 360,
    });
    expect(testId("a.B", "c")).toBe("a.B#c");
  });
});

describe("scoreTests", () => {
  it("ranks the retry-recovering tests first and the real regression at zero", () => {
    expect(scores.map((s) => s.testId).slice(0, 3)).toEqual([
      "com.acme.shop.CheckoutTest#appliesCoupon",
      "com.acme.shop.SearchTest#findsByName",
      "com.acme.shop.CartTest#removesItem",
    ]);
    expect(score("com.acme.shop.PaymentGatewayTest#chargesCard").score).toBe(0);
    expect(score("com.acme.shop.CartTest#addsItem").score).toBe(0);
  });

  it("computes flips, recoveries and the Wilson interval for the flaky coupon test", () => {
    const coupon = score("com.acme.shop.CheckoutTest#appliesCoupon");
    expect(coupon).toMatchObject({
      executions: 24,
      runs: 36,
      passes: 24,
      failures: 12,
      skipped: 0,
      flips: 8,
      sameCommitPairs: 15,
      flipRate: 0.533,
      recoveries: 8,
      rerunRecoveryRate: 0.667,
      distinctFailures: 2,
      failureMessageEntropy: 0.918,
      lastOutcome: "PASS",
      lastRunAt: "2026-09-10T21:01:00Z",
    });
    expect(coupon.flipInterval).toEqual({ lower: 0.301, upper: 0.752 });
    expect(coupon.recoveryInterval.lower).toBe(0.391);
    expect(coupon.score).toBe(0.469);
    expect(coupon.components.map((c) => c.contribution)).toEqual([0.195, 0.09, 0.184]);
    expect(coupon.components[0]?.note).toContain("8 of 12 failures");
  });

  it("does not treat a consistent failure as flaky, even with a runner correlation", () => {
    const payment = score("com.acme.shop.PaymentGatewayTest#chargesCard");
    expect(payment.failures).toBe(6);
    expect(payment.flips).toBe(0);
    expect(payment.recoveries).toBe(0);
    expect(payment.lastOutcome).toBe("FAIL");
    const inventory = score("com.acme.shop.InventoryTest#reservesStock");
    expect(inventory.runnerCorrelation).toBe(1);
    expect(inventory.score).toBeLessThan(FLAKY_THRESHOLD);
  });

  it("keeps a skipped-only test at zero with no interval evidence", () => {
    const report = score("com.acme.shop.ReportTest#exportsCsv");
    expect(report.skipped).toBe(24);
    expect(report.sameCommitPairs).toBe(0);
    expect(report.flipInterval).toEqual({ lower: 0, upper: 1 });
  });
});

describe("executionsOf", () => {
  it("groups reruns inside a build and flags flips against the previous attempt", () => {
    const coupon = score("com.acme.shop.CheckoutTest#appliesCoupon");
    expect(coupon.history[1]).toEqual({
      buildId: 2,
      timestamp: "2026-07-17T21:00:00Z",
      commit: "c02",
      attempt: 1,
      runner: "ubuntu-latest",
      outcomes: ["FAIL", "PASS"],
      final: "PASS",
      flaky: true,
    });
    const inventory = score("com.acme.shop.InventoryTest#reservesStock");
    const rerun = inventory.history.find((e) => e.attempt === 2 && e.runner === "ubuntu-arm");
    expect(rerun?.final).toBe("FAIL");
    expect(rerun?.flaky).toBe(true);
  });

  it("returns nothing for a test with no runs", () => {
    expect(executionsOf(history, [])).toEqual([]);
  });
});

describe("flakinessTrend and summariseFlakiness", () => {
  it("buckets executions by week and reports the falling rate", () => {
    const trend = flakinessTrend(scores, NOW, 4);
    expect(trend.map((p) => p.week)).toEqual([
      "2026-08-17",
      "2026-08-24",
      "2026-08-31",
      "2026-09-07",
    ]);
    expect(trend.map((p) => p.rate)).toEqual([0, 0.048, 0.048, 0.071]);
    expect(trend[3]).toEqual({ week: "2026-09-07", executions: 14, flaky: 1, rate: 0.071 });
  });

  it("summarises counts and the eight-week trend", () => {
    const summary = summariseFlakiness(history, scores, NOW);
    expect(summary).toMatchObject({
      tests: 8,
      flakyTests: 2,
      builds: 24,
      executions: 192,
      latestRunAt: "2026-09-10T21:00:00Z",
    });
    expect(summary.trend).toHaveLength(8);
    expect(summary.trend[0]?.rate).toBeGreaterThan(summary.trend[7]?.rate ?? 1);
  });
});
