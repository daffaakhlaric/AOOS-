import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { HeatmapResponseDto } from "@/types/dashboard.types";

// See `app/api/settings/route.ts`'s comment on this same export — this handler also reads the
// caller's real session cookies (via `resolveRouteSession`) on every request.
export const dynamic = "force-dynamic";

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
 *
 * TENANT-SCOPING FIX (Phase T2, docs/PROMPT-AAOS-META-ADS-TENANT-SCOPING.md): forwards
 * `x-tenant-id: session.tenantId` (this proxy previously called `aaos-api` with no tenant header
 * at all, now that `MetaAdsController.getHeatmap` reads one), and `cacheKey` now includes that
 * real tenant id too — this cache is process-wide, so without a tenant-scoped key one tenant's
 * cached heatmap would leak to a second tenant's matching `adAccountId`/`datePreset` request, same
 * fix `/api/campaigns/route.ts` needed for the identical reason.
 */

// Meta rate-limit UX mitigation (docs/PROMPT-AAOS-GEO-TARGETING-AND-REGION-PICKER.md Part C) — same
// 5→15-minute bump as `/api/campaigns/route.ts`'s own `CACHE_TTL_MS`, same reasoning: see that
// file's docstring above for why (the Meta Ads Tenant-Scoping Fix's real, accepted tradeoff, not a
// new bug).
const CACHE_TTL_MS = 900_000; // 15 minutes

interface CacheEntry {
  readonly body: HeatmapResponseDto;
  readonly cachedAt: number;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(
  tenantId: string,
  adAccountId: string | undefined,
  datePreset: string | undefined,
): string {
  return `${tenantId}::${adAccountId ?? ""}::${datePreset ?? ""}`;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  const adAccountId = request.nextUrl.searchParams.get("adAccountId") ?? undefined;
  const datePreset = request.nextUrl.searchParams.get("datePreset") ?? undefined;
  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";
  const key = cacheKey(session.tenantId, adAccountId, datePreset);

  const cached = cache.get(key);
  if (!forceRefresh && cached !== undefined && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return NextResponse.json(cached.body);
  }

  try {
    const data = await callAaosApi<HeatmapResponseDto>("/api/v1/analytics/heatmap", {
      searchParams: { adAccountId, datePreset },
      headers: { "x-tenant-id": session.tenantId },
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
