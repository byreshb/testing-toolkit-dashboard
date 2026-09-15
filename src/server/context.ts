import { resolveDataDir, resolveNow, resolveToolDirs, type ToolDirs } from "@/data/config";

export interface DashboardContext {
  dataDir: string;
  dirs: ToolDirs;
  now: Date;
}

/** Resolves the data directory and clock for one request. Reads happen fresh every time. */
export function dashboardContext(): DashboardContext {
  const dataDir = resolveDataDir();
  return { dataDir, dirs: resolveToolDirs(dataDir), now: resolveNow() };
}
