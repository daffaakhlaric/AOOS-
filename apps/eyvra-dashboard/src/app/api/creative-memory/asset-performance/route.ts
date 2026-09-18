import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { AssetPerformanceResponseDto } from "@/types/asset-performance.types";

// See `app/api/settings/route.ts`'s comment on this same export — this handler also reads the
// caller's real session cookies (via `resolveRouteSession`) on every request.
export const dynamic = "force-dynamic";

/**
 * `GET /api/creative-memory/asset-performance` — proxies `GET
 * /api/v1/creative-memory/asset-performance` (EYVRA — SAMANTHA V2 + KAI V2 Phase 21's real Kai V2
 * Asset Analyzer, Phase 22's UI surface for it). Tenant-wide (no `campaignId`/`listingId` path
 * segment), same shape as `angle-performance/route.ts`'s own tenant-wide proxy — this endpoint is
 * that one's per-asset sibling, not a per-campaign one.
 *
 * Optional `?since=YYYY-MM-DD&until=YYYY-MM-DD` passthrough, mirroring the real backend's own
 * validation (`AssetPerformanceQuerySchema`, same rule `AnglePerformanceQuerySchema` already
 * establishes): both together, or both omitted for lifetime — a lone `since`/`until` is rejected
 * upstream, so this route does not attempt to "fix" a partial pair itself, it just forwards whatever
 * the caller sent and lets `aaos-api` be the single source of truth for that rule.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  const url = new URL(request.url);
  try {
    const data = await callAaosApi<AssetPerformanceResponseDto>(
      "/api/v1/creative-memory/asset-performance",
      {
        headers: { "x-tenant-id": session.tenantId },
        searchParams: {
          since: url.searchParams.get("since") ?? undefined,
          until: url.searchParams.get("until") ?? undefined,
        },
      },
    );
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
