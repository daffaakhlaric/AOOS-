import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { SimulationStatusDto } from "@/types/dashboard.types";

export const dynamic = "force-dynamic";

/**
 * `GET /api/simulation/live` — proxies `GET /api/v1/simulation/live` (AAOS-GO-LIVE, Phase 4), the
 * `/go-live` Monitor page's real data source. Forwards `x-tenant-id: session.tenantId`
 * (AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 5, coordinator note section 9), same as every other
 * Simulasi proxy route now does — see `history/route.ts`'s doc for why this is sent even though
 * `aaos-api`'s side doesn't read it on this endpoint yet.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  try {
    const data = await callAaosApi<readonly SimulationStatusDto[]>("/api/v1/simulation/live", {
      headers: { "x-tenant-id": session.tenantId },
    });
    return NextResponse.json({ live: data });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
