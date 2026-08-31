import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { ActivityListDto } from "@/types/dashboard.types";

// See `app/api/settings/route.ts`'s comment on this same export — this GET handler also reads
// the caller's real session cookies on every request.
export const dynamic = "force-dynamic";

/** `GET /api/activity-log` — proxies `GET /api/v1/activity-log` (Activity Log page's list/filter bar, historical read path only — LIVE updates come from the dashboard's own direct `postgres_changes` subscription, `lib/realtime.ts`'s `subscribeToActivityLog`). */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  const url = new URL(request.url);
  try {
    const data = await callAaosApi<ActivityListDto>("/api/v1/activity-log", {
      headers: { "x-tenant-id": session.tenantId },
      searchParams: {
        agent: url.searchParams.get("agent") ?? undefined,
        status: url.searchParams.get("status") ?? undefined,
        mode: url.searchParams.get("mode") ?? undefined,
        limit: url.searchParams.get("limit") ?? undefined,
      },
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
