import { dashboardContext } from "@/server/context";
import { flakyView } from "@/server/flaky";

export const dynamic = "force-dynamic";

/** One test's score, components and per-build history. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ testId: string }> },
): Promise<Response> {
  const { testId } = await params;
  const id = decodeURIComponent(testId);
  const view = flakyView(dashboardContext());
  const score = view?.scores.find((s) => s.testId === id);
  if (view === undefined || score === undefined) {
    return Response.json({ error: `no history for ${id}` }, { status: 404 });
  }
  const quarantine = view.quarantine?.entries.find((e) => e.test === id) ?? null;
  return Response.json({ test: score, quarantine });
}
