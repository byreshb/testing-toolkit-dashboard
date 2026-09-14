import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveDataDir, resolveNow, resolveToolDirs } from "./config";

const FIXTURE_REPO = resolve("fixtures/acme-shop");

describe("resolveDataDir", () => {
  it("prefers the --data argument over the environment", () => {
    const dir = resolveDataDir({
      argv: ["--data", "/from/args"],
      env: { TOOLKIT_DATA_DIR: "/from/env" },
      cwd: "/cwd",
    });
    expect(dir).toBe("/from/args");
  });

  it("accepts the --data=<dir> form and resolves it against the working directory", () => {
    expect(resolveDataDir({ argv: ["--data=./here"], env: {}, cwd: "/cwd" })).toBe("/cwd/here");
  });

  it("falls back to TOOLKIT_DATA_DIR and then the working directory", () => {
    expect(resolveDataDir({ argv: [], env: { TOOLKIT_DATA_DIR: "data" }, cwd: "/cwd" })).toBe(
      "/cwd/data",
    );
    expect(resolveDataDir({ argv: [], env: {}, cwd: "/cwd" })).toBe("/cwd");
  });

  it("ignores a trailing --data with no value", () => {
    expect(resolveDataDir({ argv: ["--data"], env: {}, cwd: "/cwd" })).toBe("/cwd");
  });
});

describe("resolveToolDirs", () => {
  it("finds the tools' default output locations under a repository root", () => {
    const dirs = resolveToolDirs(FIXTURE_REPO);
    expect(dirs.flake).toBe(join(FIXTURE_REPO, ".flake"));
    expect(dirs.tql).toBe(join(FIXTURE_REPO, "target/tql"));
    expect(dirs.llmEval).toBe(join(FIXTURE_REPO, "target/llm-eval"));
  });

  it("finds the flat layout prepared for the dashboard", () => {
    const root = mkdtempSync(join(tmpdir(), "toolkit-"));
    mkdirSync(join(root, "flake"));
    writeFileSync(join(root, "flake", "history.db"), "");
    mkdirSync(join(root, "tql"));
    mkdirSync(join(root, "llm-eval"));
    expect(resolveToolDirs(root)).toEqual({
      flake: join(root, "flake"),
      tql: join(root, "tql"),
      llmEval: join(root, "llm-eval"),
    });
  });

  it("treats a directory that directly contains history.db as the flake directory", () => {
    const root = mkdtempSync(join(tmpdir(), "toolkit-"));
    writeFileSync(join(root, "history.db"), "");
    expect(resolveToolDirs(root)).toEqual({ flake: root });
  });

  it("omits tools whose files are absent", () => {
    const root = mkdtempSync(join(tmpdir(), "toolkit-"));
    expect(resolveToolDirs(root)).toEqual({});
  });
});

describe("resolveNow", () => {
  it("uses TOOLKIT_NOW when it is a valid instant", () => {
    expect(resolveNow({ TOOLKIT_NOW: "2026-09-13T12:00:00Z" }).toISOString()).toBe(
      "2026-09-13T12:00:00.000Z",
    );
  });

  it("falls back to the clock when TOOLKIT_NOW is missing or invalid", () => {
    const before = Date.now();
    expect(resolveNow({}).getTime()).toBeGreaterThanOrEqual(before);
    expect(resolveNow({ TOOLKIT_NOW: "not a date" }).getTime()).toBeGreaterThanOrEqual(before);
  });
});
