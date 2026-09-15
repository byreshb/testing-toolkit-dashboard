import { dashboardContext } from "@/server/context";
import { flakyView } from "@/server/flaky";

export const dynamic = "force-dynamic";

/** Ranked tests (without per-build history), the summary and the quarantine ledger. */
export function GET(): Response {
  const view = flakyView(dashboardContext());
  if (view === undefined) {
    return Response.json({ error: "no flake history found" }, { status: 404 });
  }
  return Response.json({
    summary: view.summary,
    tests: view.scores.map(({ history: _history, ...rest }) => rest),
    quarantine: view.quarantine,
  });
}
