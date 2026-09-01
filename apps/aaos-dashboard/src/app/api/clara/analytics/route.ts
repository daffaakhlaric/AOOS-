import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { LeadsAnalyticsDto } from "@/types/dashboard.types";

export const dynamic = "force-dynamic";

/**
 * `GET /api/clara/analytics?days=` — proxies `aaos-api`'s real, new `GET /api/v1/leads/analytics`
 * (MENU RESTRUCTURE FINAL `/clara/analytics`). Same thin-proxy discipline as every other route in
 * this file — no client-side aggregation, `aaos-api` computes every KPI.
 *
 * PROPERTY-TENANT-ISOLATION Phase 1 (security fix): forwards the real logged-in session's
 * `tenantId` as `x-tenant-id` — this backs the real `/api/v1/leads*` surface, so it gets the same
 * tenant-scoping fix as every other leads-related route in this app.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  const days = request.nextUrl.searchParams.get("days") ?? undefined;
  try {
    const analytics = await callAaosApi<LeadsAnalyticsDto>("/api/v1/leads/analytics", {
      searchParams: { days },
      headers: { "x-tenant-id": session.tenantId },
    });
    return NextResponse.json(analytics);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
