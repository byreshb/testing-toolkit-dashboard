import {
  resolveNow,
  resolveRepos,
  resolveToolDirs,
  selectRepo,
  type RepoConfig,
  type ToolDirs,
} from "@/data/config";

/** The search params every page reads to pick the active repository. */
export type PageSearchParams = Promise<{ repo?: string }>;

/** The `?repo=` query param from an API route's request URL, for the same purpose. */
export function repoFromRequest(request: Request): string | undefined {
  return new URL(request.url).searchParams.get("repo") ?? undefined;
}

export interface DashboardContext {
  dataDir: string;
  dirs: ToolDirs;
  now: Date;
  repos: RepoConfig[];
  activeRepo: RepoConfig;
}

/**
 * Resolves the active repository, its tool directories and the clock for one request. Reads
 * happen fresh every time. `repoName` comes from the page's `?repo=` search param; omit it (or
 * pass a name that matches no configured repo) to get the first configured repo. `resolveRepos`
 * always returns at least one entry, so there is always an active repo.
 */
export function dashboardContext(repoName?: string): DashboardContext {
  const repos = resolveRepos();
  const activeRepo = selectRepo(repos, repoName);
  if (activeRepo === undefined) {
    throw new Error("no repositories configured");
  }
  return {
    dataDir: activeRepo.dir,
    dirs: resolveToolDirs(activeRepo.dir),
    now: resolveNow(),
    repos,
    activeRepo,
  };
}
