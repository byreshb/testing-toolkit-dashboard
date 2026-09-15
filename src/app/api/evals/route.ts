import { dashboardContext, repoFromRequest } from "@/server/context";
import { evalsView } from "@/server/evals";

export const dynamic = "force-dynamic";

export function GET(request: Request): Response {
  const view = evalsView(dashboardContext(repoFromRequest(request)));
  if (view === undefined) {
    return Response.json({ error: "no eval reports found" }, { status: 404 });
  }
  return Response.json(view);
}
