import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveDataDir, resolveNow, resolveRepos, resolveToolDirs, selectRepo } from "./config";

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

describe("resolveRepos", () => {
  it("parses name=path entries from TOOLKIT_REPOS, resolved against the working directory", () => {
    const repos = resolveRepos({
      env: { TOOLKIT_REPOS: "acme=./acme, widgets = /abs/widgets " },
      cwd: "/cwd",
    });
    expect(repos).toEqual([
      { name: "acme", dir: "/cwd/acme" },
      { name: "widgets", dir: "/abs/widgets" },
    ]);
  });

  it("skips blank entries", () => {
    expect(resolveRepos({ env: { TOOLKIT_REPOS: "a=./a,,  ," }, cwd: "/cwd" })).toEqual([
      { name: "a", dir: "/cwd/a" },
    ]);
  });

  it("treats an entry with no = as both the name and the path", () => {
    expect(resolveRepos({ env: { TOOLKIT_REPOS: "./only" }, cwd: "/cwd" })).toEqual([
      { name: "./only", dir: "/cwd/only" },
    ]);
  });

  it("falls back to a single repo named after --data/TOOLKIT_DATA_DIR when unset", () => {
    expect(
      resolveRepos({ argv: ["--data", "/cwd/fixtures/acme-shop"], env: {}, cwd: "/cwd" }),
    ).toEqual([{ name: "acme-shop", dir: "/cwd/fixtures/acme-shop" }]);
    expect(resolveRepos({ argv: [], env: { TOOLKIT_REPOS: "  " }, cwd: "/cwd" })).toEqual([
      { name: "cwd", dir: "/cwd" },
    ]);
  });
});

describe("selectRepo", () => {
  const repos = [
    { name: "a", dir: "/a" },
    { name: "b", dir: "/b" },
  ];

  it("picks the named repo, or the first one when the name is missing or unknown", () => {
    expect(selectRepo(repos, "b")).toEqual({ name: "b", dir: "/b" });
    expect(selectRepo(repos)).toEqual({ name: "a", dir: "/a" });
    expect(selectRepo(repos, "nope")).toEqual({ name: "a", dir: "/a" });
  });

  it("returns undefined for an empty list", () => {
    expect(selectRepo([])).toBeUndefined();
  });
});
