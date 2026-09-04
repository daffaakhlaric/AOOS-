import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { OverviewResponseDto } from "@/types/dashboard.types";

// See `app/api/settings/route.ts`'s comment on this same export — this GET handler also reads
// the caller's real session cookies on every request.
export const dynamic = "force-dynamic";

/**
 * `GET /api/overview` — thin proxy to `apps/aaos-api`'s real `GET /api/v1/overview` (AAOS Overview
 * Monitor Phase O1's one aggregate endpoint), forwarding `x-tenant-id: session.tenantId` — the
 * same real per-request tenant-scoping convention every proxy route in this app already
 * establishes (`app/api/settings/route.ts`, `app/api/activity-log/route.ts`). Returns the real
 * `OverviewResponseDto` body as-is — no reshaping, no client-side aggregation; `OverviewService`
 * already composed everything server-side (Phase O1, already committed).
 *
 * Phase O2's PROPERTY-only Overview Monitor page (`components/overview/OverviewMonitorClient.tsx`)
 * is this route's only real caller today.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  try {
    const data = await callAaosApi<OverviewResponseDto>("/api/v1/overview", {
      headers: { "x-tenant-id": session.tenantId },
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
