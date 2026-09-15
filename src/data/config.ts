import { existsSync } from "node:fs";
import { basename, isAbsolute, resolve } from "node:path";

/** Environment variables, as a plain record so callers can pass a subset. */
export type Env = Readonly<Record<string, string | undefined>>;

/** Where the dashboard looks for each tool's files inside a data directory. */
export interface ToolDirs {
  /** Directory holding `history.db` and `quarantine.yaml` from the flake detector. */
  flake?: string;
  /** Directory holding SARIF or JSON reports from the test-quality linter. */
  tql?: string;
  /** Directory holding `report*.json` files and a `baselines/` folder from the eval harness. */
  llmEval?: string;
}

export interface ResolveOptions {
  env?: Env;
  argv?: readonly string[];
  cwd?: string;
}

/**
 * Resolves the data directory from, in order of precedence, a `--data <dir>` (or `--data=<dir>`)
 * argument, the `TOOLKIT_DATA_DIR` environment variable, and finally the current directory.
 */
export function resolveDataDir(options: ResolveOptions = {}): string {
  const env = options.env ?? process.env;
  const argv = options.argv ?? process.argv.slice(2);
  const cwd = options.cwd ?? process.cwd();
  const fromArgs = dataArg(argv);
  const chosen = fromArgs ?? env.TOOLKIT_DATA_DIR ?? ".";
  return isAbsolute(chosen) ? chosen : resolve(cwd, chosen);
}

function dataArg(argv: readonly string[]): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--data") {
      return argv[i + 1];
    }
    if (arg?.startsWith("--data=")) {
      return arg.slice("--data=".length);
    }
  }
  return undefined;
}

const FLAKE_CANDIDATES = [".flake", "flake", "."];
const TQL_CANDIDATES = ["tql", "target/tql"];
const LLM_EVAL_CANDIDATES = ["llm-eval", "target/llm-eval"];

/**
 * Locates each tool's output inside a data directory. The directory may be a repository root
 * (the tools' default output locations are searched) or a directory prepared for the dashboard
 * with `flake/`, `tql/` and `llm-eval/` subdirectories. A tool whose files are absent is simply
 * missing from the result; pages then show an empty state for it.
 */
export function resolveToolDirs(dataDir: string): ToolDirs {
  const dirs: ToolDirs = {};
  const flake = firstExisting(dataDir, FLAKE_CANDIDATES, "history.db");
  if (flake !== undefined) {
    dirs.flake = flake;
  }
  const tql = firstExisting(dataDir, TQL_CANDIDATES);
  if (tql !== undefined) {
    dirs.tql = tql;
  }
  const llmEval = firstExisting(dataDir, LLM_EVAL_CANDIDATES);
  if (llmEval !== undefined) {
    dirs.llmEval = llmEval;
  }
  return dirs;
}

function firstExisting(
  root: string,
  candidates: readonly string[],
  marker?: string,
): string | undefined {
  for (const candidate of candidates) {
    const dir = resolve(root, candidate);
    if (existsSync(marker === undefined ? dir : resolve(dir, marker))) {
      return dir;
    }
  }
  return undefined;
}

export interface RepoConfig {
  name: string;
  dir: string;
}

/**
 * The repositories the dashboard can show. When `TOOLKIT_REPOS` (a comma-separated list of
 * `name=path` entries, for example `acme-shop=../acme-shop,widgets=../widgets`) is set, those
 * are the choices, each path resolved against the working directory like `--data`. Otherwise
 * there is exactly one repository, resolved the same way as before (`--data`,
 * `TOOLKIT_DATA_DIR`, the working directory) and named after its last path segment.
 */
export function resolveRepos(options: ResolveOptions = {}): RepoConfig[] {
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();
  const raw = env.TOOLKIT_REPOS;
  const entries = (raw ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");
  if (entries.length > 0) {
    return entries.map((entry) => {
      const eq = entry.indexOf("=");
      const name = eq === -1 ? entry : entry.slice(0, eq).trim();
      const rawDir = (eq === -1 ? entry : entry.slice(eq + 1)).trim();
      const dir = isAbsolute(rawDir) ? rawDir : resolve(cwd, rawDir);
      return { name, dir };
    });
  }
  const dataDir = resolveDataDir(options);
  return [{ name: basename(dataDir) || dataDir, dir: dataDir }];
}

/** Picks the repo named `repoName`, falling back to the first configured repo. */
export function selectRepo(
  repos: readonly RepoConfig[],
  repoName?: string,
): RepoConfig | undefined {
  return (repoName === undefined ? undefined : repos.find((r) => r.name === repoName)) ?? repos[0];
}

/**
 * The dashboard's notion of "now". `TOOLKIT_NOW` (an ISO 8601 instant) overrides the clock so
 * that expiry warnings and trend windows are reproducible in tests and demos.
 */
export function resolveNow(env: Env = process.env): Date {
  const override = env.TOOLKIT_NOW;
  if (override !== undefined && override !== "") {
    const parsed = new Date(override);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return new Date();
}
