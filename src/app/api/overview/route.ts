import { readOverview } from "@/data/overview";
import { dashboardContext, repoFromRequest } from "@/server/context";

export const dynamic = "force-dynamic";

export function GET(request: Request): Response {
  const { dataDir, now } = dashboardContext(repoFromRequest(request));
  return Response.json(readOverview(dataDir, now));
}
