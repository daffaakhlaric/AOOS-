import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { HeatmapResponseDto } from "@/types/dashboard.types";

/**
 * `GET /api/analytics/heatmap` — proxies `GET /api/v1/analytics/heatmap` on `aaos-api` (AAOS
 * Analytics Platform Phase 3, "Audience × Creative Heatmap"). `aaos-api`'s response is already
 * shaped exactly as this app's `HeatmapResponseDto` — no reshaping needed here (contrast
 * `/api/campaigns/route.ts`, which reshapes a differently-keyed upstream DTO).
 *
 * Same real, established 5-minute in-memory server-side cache convention `/api/campaigns/route.ts`
 * already uses (see that file's own docstring for why: a second, server-side layer above the
 * `aaos-api`→Meta Insights API round-trip, protecting against multiple tabs/sessions each
 * independently deciding they need a fresh pull around the same time) — not a second, independently
 * invented caching approach.
 */

const CACHE_TTL_MS = 300_000; // 5 minutes

interface CacheEntry {
  readonly body: HeatmapResponseDto;
  readonly cachedAt: number;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(adAccountId: string | undefined, datePreset: string | undefined): string {
  return `${adAccountId ?? ""}::${datePreset ?? ""}`;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const adAccountId = request.nextUrl.searchParams.get("adAccountId") ?? undefined;
  const datePreset = request.nextUrl.searchParams.get("datePreset") ?? undefined;
  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";
  const key = cacheKey(adAccountId, datePreset);

  const cached = cache.get(key);
  if (!forceRefresh && cached !== undefined && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return NextResponse.json(cached.body);
  }

  try {
    const data = await callAaosApi<HeatmapResponseDto>("/api/v1/analytics/heatmap", {
      searchParams: { adAccountId, datePreset },
    });
    cache.set(key, { body: data, cachedAt: Date.now() });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
