import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { AssetDetailResponseDto } from "@/types/dashboard.types";

// See `app/api/settings/route.ts`'s comment on this same export — this handler also reads the
// caller's real session cookies (via `resolveRouteSession`) on every request.
export const dynamic = "force-dynamic";

/**
 * `GET /api/analytics/assets/:id` — proxies `GET /api/v1/analytics/assets/:assetId` on `aaos-api`
 * (AAOS Analytics Platform Phase 4, "Asset detail / Creative Drill-Down"). Same `adAccountId?`/
 * `datePreset?` query passthrough `/api/analytics/heatmap/route.ts` already establishes.
 *
 * No second in-memory cache layer here (unlike `/api/analytics/heatmap/route.ts`'s own 5-minute
 * cache): this endpoint also triggers a real LLM call server-side (`LlmService.assetInsight`) —
 * `aaos-api`'s own `ResponseCache` (30-minute TTL, same body → same cached LLM answer) already
 * covers the expensive part; adding a second, shorter-TTL cache on top would only ever return a
 * STALER copy of the same real data, never a fresher one.
 *
 * TENANT-SCOPING FIX (Phase T2, docs/PROMPT-AAOS-META-ADS-TENANT-SCOPING.md): forwards
 * `x-tenant-id: session.tenantId` — this proxy previously called `aaos-api` with no tenant header
 * at all, now that `MetaAdsController.getAssetDetail` reads one.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  const adAccountId = request.nextUrl.searchParams.get("adAccountId") ?? undefined;
  const datePreset = request.nextUrl.searchParams.get("datePreset") ?? undefined;

  try {
    const data = await callAaosApi<AssetDetailResponseDto>(
      `/api/v1/analytics/assets/${encodeURIComponent(params.id)}`,
      { searchParams: { adAccountId, datePreset }, headers: { "x-tenant-id": session.tenantId } },
    );
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
