import { dashboardContext } from "@/server/context";
import { qualityView } from "@/server/quality";

export const dynamic = "force-dynamic";

export function GET(): Response {
  const view = qualityView(dashboardContext());
  if (view === undefined) {
    return Response.json({ error: "no lint runs found" }, { status: 404 });
  }
  return Response.json(view);
}
