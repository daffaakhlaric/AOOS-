import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { OverviewTimeseriesResponseDto } from "@/types/dashboard.types";

// See `app/api/overview/route.ts`'s own comment on this same export — this GET handler also reads
// the caller's real session cookies on every request.
export const dynamic = "force-dynamic";

/**
 * `GET /api/overview/timeseries` — thin proxy to `apps/aaos-api`'s real
 * `GET /api/v1/overview/timeseries` (EYVRA SAMANTHA V2 + KAI V2 Phase 56, Command Center
 * "Performance Overview" chart), forwarding `x-tenant-id: session.tenantId` and the real `days`
 * query param when present — the SAME real per-request tenant-scoping + proxy convention
 * `app/api/overview/route.ts` already establishes. Returns the real `OverviewTimeseriesResponseDto`
 * body as-is — no reshaping, no client-side aggregation.
 *
 * `components/command-center/CommandCenterClient.tsx`'s `PerformanceOverviewChart` is this route's
 * only real caller today.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  const days = request.nextUrl.searchParams.get("days") ?? undefined;
  try {
    const data = await callAaosApi<OverviewTimeseriesResponseDto>("/api/v1/overview/timeseries", {
      headers: { "x-tenant-id": session.tenantId },
      searchParams: { days },
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
