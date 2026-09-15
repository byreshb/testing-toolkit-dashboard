import { readOverview } from "@/data/overview";
import { dashboardContext } from "@/server/context";

export const dynamic = "force-dynamic";

export function GET(): Response {
  const { dataDir, now } = dashboardContext();
  return Response.json(readOverview(dataDir, now));
}
