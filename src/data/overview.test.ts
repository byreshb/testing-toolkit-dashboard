import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { readOverview } from "./overview";

const NOW = new Date("2026-09-13T12:00:00Z");

describe("readOverview", () => {
  it("combines the three summaries for the fixture repository", () => {
    const overview = readOverview(resolve("fixtures/acme-shop"), NOW);
    expect(overview.now).toBe("2026-09-13T12:00:00.000Z");
    expect(overview.dirs.flake).toBe(resolve("fixtures/acme-shop/.flake"));
    expect(overview.flake?.flakyTests).toBe(2);
    expect(overview.quarantine?.entries.map((e) => e.status)).toEqual(["expired", "expiring"]);
    expect(overview.lint?.latestFindings).toBe(4);
    expect(overview.evals?.latestMeanScore).toBe(0.849);
  });

  it("returns nulls for an empty directory", () => {
    const dir = mkdtempSync(join(tmpdir(), "empty-"));
    expect(readOverview(dir, NOW)).toEqual({
      dataDir: dir,
      dirs: {},
      now: NOW.toISOString(),
      flake: null,
      quarantine: null,
      lint: null,
      evals: null,
    });
  });
});
