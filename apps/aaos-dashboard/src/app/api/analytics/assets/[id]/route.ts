import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { AssetDetailResponseDto } from "@/types/dashboard.types";

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
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const adAccountId = request.nextUrl.searchParams.get("adAccountId") ?? undefined;
  const datePreset = request.nextUrl.searchParams.get("datePreset") ?? undefined;

  try {
    const data = await callAaosApi<AssetDetailResponseDto>(
      `/api/v1/analytics/assets/${encodeURIComponent(params.id)}`,
      { searchParams: { adAccountId, datePreset } },
    );
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
