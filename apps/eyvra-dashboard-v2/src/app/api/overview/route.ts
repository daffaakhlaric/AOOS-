import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { OverviewResponseDto } from "@/types/dashboard.types";

export const dynamic = "force-dynamic";

/** `GET /api/overview` — thin proxy to aaos-api's real `GET /api/v1/overview`, same resolveRouteSession -> 401 -> callAaosApi(x-tenant-id) -> JSON passthrough convention apps/eyvra-dashboard's own proxy routes establish. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  try {
    const data = await callAaosApi<OverviewResponseDto>("/api/v1/overview", {
      headers: { "x-tenant-id": session.tenantId },
      signal: request.signal,
      // The first request after a dev-server restart can include Next's route compilation
      // before aaos-api returns its partial real-data response. Give that cold start enough
      // room while still bounding a genuinely stuck upstream call.
      /**
       * 30s was timing out in real use: `GET /api/v1/overview` performs a LIVE Meta campaign-tree
       * pull (36 campaigns / 47 ad sets / 45 ads on the real tenant) on every request, measured at
       * 108-128s. The real fix is to serve that section from the already-synced
       * `meta_campaigns`/`meta_insights_daily` tables instead of pulling Meta per request; until
       * then this ceiling has to clear the real upstream latency, or the page shows a timeout error
       * instead of data.
       */
      timeoutMs: 180_000,
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
