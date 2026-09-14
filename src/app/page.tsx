import { resolveDataDir, resolveToolDirs } from "@/data/config";

export const dynamic = "force-dynamic";

export default function OverviewPage() {
  const dataDir = resolveDataDir();
  const dirs = resolveToolDirs(dataDir);
  return (
    <>
      <h1>Overview</h1>
      <p>
        Reading data from <code>{dataDir}</code>.
      </p>
      <ul>
        <li>Flake detector: {dirs.flake ?? "not found"}</li>
        <li>Test-quality linter: {dirs.tql ?? "not found"}</li>
        <li>LLM eval harness: {dirs.llmEval ?? "not found"}</li>
      </ul>
    </>
  );
}
