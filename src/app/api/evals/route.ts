import { dashboardContext } from "@/server/context";
import { evalsView } from "@/server/evals";

export const dynamic = "force-dynamic";

export function GET(): Response {
  const view = evalsView(dashboardContext());
  if (view === undefined) {
    return Response.json({ error: "no eval reports found" }, { status: 404 });
  }
  return Response.json(view);
}
