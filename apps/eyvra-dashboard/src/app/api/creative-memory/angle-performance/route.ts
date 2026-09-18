import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { AnglePerformanceResponseDto } from "@/types/angle-performance.types";

// See `app/api/settings/route.ts`'s comment on this same export — this handler also reads the
// caller's real session cookies (via `resolveRouteSession`) on every request.
export const dynamic = "force-dynamic";

/**
 * `GET /api/creative-memory/angle-performance` — proxies `GET
 * /api/v1/creative-memory/angle-performance` (EYVRA — SAMANTHA V2 + KAI V2 Phase 2's real Creative
 * Performance Memory ranking engine, Phase 17's first UI surface for it). Tenant-wide (no
 * `campaignId`/`listingId` path segment), unlike `campaign-health`'s per-campaign proxy — closer in
 * shape to `listings/route.ts`'s tenant-wide list proxy.
 *
 * Optional `?since=YYYY-MM-DD&until=YYYY-MM-DD` passthrough, mirroring the real backend's own
 * validation (`AnglePerformanceQuerySchema`): both together, or both omitted for lifetime — a lone
 * `since`/`until` is rejected upstream, so this route does not attempt to "fix" a partial pair
 * itself, it just forwards whatever the caller sent and lets `aaos-api` be the single source of
 * truth for that rule.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  const url = new URL(request.url);
  try {
    const data = await callAaosApi<AnglePerformanceResponseDto>(
      "/api/v1/creative-memory/angle-performance",
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
