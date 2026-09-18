import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { OpportunitiesResponseDto } from "@/types/opportunities.types";

// See `app/api/settings/route.ts`'s comment on this same export — this handler also reads the
// caller's real session cookies (via `resolveRouteSession`) on every request.
export const dynamic = "force-dynamic";

/**
 * `GET /api/opportunities/:campaignId` — proxies `GET /api/v1/opportunities/:campaignId`
 * (EYVRA — SAMANTHA V2 + KAI V2 Phase 9/13: real, deterministic `SCALING_OPPORTUNITY`/
 * `CREATIVE_WINNER_EXPANSION` detectors over already-computed Phase 4 `SamanthaDecision`/Phase 2
 * `AnglePerformanceResult` outputs — no LLM call). Like `campaign-health/route.ts`, this real
 * backend endpoint is its own top-level `api/v1/opportunities` route, NOT nested under
 * `api/v1/campaigns/:campaignId` — see `opportunities.controller.ts`'s own `@Controller` path —
 * and `:campaignId` here is the real `meta_campaign_id`, so callers must pass `campaign.metaId`,
 * never the internal `campaign.id`.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { campaignId: string } },
): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }

  try {
    const data = await callAaosApi<OpportunitiesResponseDto>(
      `/api/v1/opportunities/${encodeURIComponent(params.campaignId)}`,
      { headers: { "x-tenant-id": session.tenantId } },
    );
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
