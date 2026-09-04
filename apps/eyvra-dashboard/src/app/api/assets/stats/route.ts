import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { AssetStatsDto } from "@/types/dashboard.types";

// See `app/api/settings/route.ts`'s comment on this same export — this GET handler also reads
// the caller's real session cookies on every request.
export const dynamic = "force-dynamic";

/**
 * `GET /api/assets/stats` — proxies `GET /api/v1/assets/stats` (Asset Library KPI strip).
 *
 * TENANT-SCOPING FIX (Phase T1): forwards `x-tenant-id: session.tenantId` (mirrors
 * `api/listings/route.ts`'s exact pattern) — see `app/api/assets/route.ts`'s doc note.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  try {
    const data = await callAaosApi<AssetStatsDto>("/api/v1/assets/stats", {
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
