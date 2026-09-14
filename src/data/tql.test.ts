import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  findingsPerRule,
  parseLintDocument,
  readLintRun,
  readLintRuns,
  severityFromSarifLevel,
  summariseLint,
  worstFiles,
} from "./tql";

const TQL_DIR = resolve("fixtures/acme-shop/target/tql");
const runs = readLintRuns(TQL_DIR);

describe("readLintRuns", () => {
  it("reads SARIF and JSON reports oldest first", () => {
    expect(runs.map((r) => [r.source, r.commit, r.findings.length])).toEqual([
      ["tql-2026-08-20.sarif", "c12", 9],
      ["tql-2026-09-01.sarif", "c16", 7],
      ["tql-2026-09-10.sarif", "c18", 5],
      ["tql-2026-09-12.json", "c19", 4],
    ]);
    expect(runs[0]).toMatchObject({
      startedAt: "2026-08-20T10:02:11.000Z",
      branch: "main",
      toolVersion: "1.0.0",
      filesScanned: 12,
    });
  });

  it("maps SARIF results to findings with rule names, severities and fix hints", () => {
    expect(runs[0]?.findings[0]).toEqual({
      ruleId: "TQL001",
      rule: "TautologicalAssertion",
      severity: "ERROR",
      file: "src/test/java/com/acme/shop/CartTest.java",
      line: 42,
      column: 5,
      message: "assertEquals(cart.size(), cart.size()) always passes",
      fixHint: "Compare against the expected size, for example assertEquals(2, cart.size())",
    });
    expect(runs[0]?.rules.TQL009).toBe("DisabledWithoutReason");
  });

  it("maps the JSON report the same way", () => {
    expect(runs[3]?.findings[0]).toMatchObject({
      ruleId: "TQL003",
      rule: "NoAssertion",
      severity: "WARN",
      line: 71,
      fixHint: "Assert on the merged item list",
    });
    expect(runs[3]?.startedAt).toBe("2026-09-12T09:31:27.000Z");
  });

  it("returns nothing for a missing directory and skips unrelated files", () => {
    expect(readLintRuns(join(tmpdir(), "does-not-exist"))).toEqual([]);
    const dir = mkdtempSync(join(tmpdir(), "tql-"));
    writeFileSync(join(dir, "notes.txt"), "not a report");
    writeFileSync(join(dir, "broken.json"), "{not json");
    writeFileSync(join(dir, "other.json"), JSON.stringify({ hello: "world" }));
    expect(readLintRuns(dir)).toEqual([]);
    expect(readLintRun(join(dir, "notes.txt"))).toBeUndefined();
  });

  it("falls back to the file time and defaults when a report has no metadata", () => {
    const dir = mkdtempSync(join(tmpdir(), "tql-"));
    const path = join(dir, "bare.json");
    writeFileSync(
      path,
      JSON.stringify({ findings: [{ ruleId: "TQL003", severity: "nonsense" }, { no: "id" }] }),
    );
    const run = readLintRun(path);
    expect(run?.commit).toBeNull();
    expect(run?.filesScanned).toBeNull();
    expect(run?.findings).toEqual([
      {
        ruleId: "TQL003",
        rule: "TQL003",
        severity: "WARN",
        file: "",
        line: 0,
        column: 0,
        message: "",
      },
    ]);
    expect(Date.parse(run?.startedAt ?? "")).toBeGreaterThan(Date.now() - 60_000);
  });
});

describe("parseLintDocument", () => {
  it("uses the driver's default level when a result has none, and WARN when nothing is known", () => {
    const run = parseLintDocument(
      {
        runs: [
          {
            tool: {
              driver: {
                rules: [{ id: "TQL001", defaultConfiguration: { level: "error" } }, { bad: 1 }],
              },
            },
            results: [
              { ruleId: "TQL001", message: { text: "x" } },
              { ruleId: "TQL999", message: { text: "y" } },
              { level: "error" },
            ],
          },
        ],
      },
      "min.sarif",
      "2026-01-01T00:00:00.000Z",
    );
    expect(run?.startedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(run?.findings.map((f) => [f.rule, f.severity])).toEqual([
      ["TQL001", "ERROR"],
      ["TQL999", "WARN"],
    ]);
    expect(run?.toolVersion).toBeNull();
  });

  it("rejects documents that are neither SARIF nor a linter report", () => {
    expect(parseLintDocument({ runs: ["nope"] }, "x", "2026-01-01T00:00:00Z")).toBeUndefined();
    expect(parseLintDocument({ cases: [] }, "x", "2026-01-01T00:00:00Z")).toBeUndefined();
  });

  it("maps SARIF levels", () => {
    expect(severityFromSarifLevel("error")).toBe("ERROR");
    expect(severityFromSarifLevel("warning")).toBe("WARN");
    expect(severityFromSarifLevel("note")).toBe("INFO");
    expect(severityFromSarifLevel("none")).toBe("WARN");
  });
});

describe("aggregations", () => {
  it("counts findings per rule across runs, worst latest first", () => {
    const series = findingsPerRule(runs);
    expect(series.slice(0, 3).map((s) => [s.ruleId, s.counts, s.latest])).toEqual([
      ["TQL003", [2, 2, 2, 2], 2],
      ["TQL006", [2, 1, 1, 1], 1],
      ["TQL009", [1, 1, 1, 1], 1],
    ]);
    expect(series.find((s) => s.ruleId === "TQL001")?.counts).toEqual([1, 0, 0, 0]);
    expect(findingsPerRule([])).toEqual([]);
  });

  it("lists the worst files of a run", () => {
    expect(worstFiles(runs[0], 2)).toEqual([
      {
        file: "src/test/java/com/acme/shop/CartTest.java",
        count: 3,
        bySeverity: { ERROR: 1, WARN: 2, INFO: 0 },
      },
      {
        file: "src/test/java/com/acme/shop/CheckoutTest.java",
        count: 3,
        bySeverity: { ERROR: 1, WARN: 2, INFO: 0 },
      },
    ]);
    expect(worstFiles(undefined)).toEqual([]);
  });

  it("summarises the latest run and the trend", () => {
    expect(summariseLint(runs)).toEqual({
      runs: 4,
      latestRunAt: "2026-09-12T09:31:27.000Z",
      latestFindings: 4,
      bySeverity: { ERROR: 0, WARN: 3, INFO: 1 },
      trend: [
        { startedAt: "2026-08-20T10:02:11.000Z", commit: "c12", findings: 9 },
        { startedAt: "2026-09-01T10:04:40.000Z", commit: "c16", findings: 7 },
        { startedAt: "2026-09-10T09:58:03.000Z", commit: "c18", findings: 5 },
        { startedAt: "2026-09-12T09:31:27.000Z", commit: "c19", findings: 4 },
      ],
    });
    expect(summariseLint([]).latestRunAt).toBeNull();
  });
});
