import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { CampaignHealthResponseDto } from "@/types/campaign-health.types";

// See `app/api/settings/route.ts`'s comment on this same export — this handler also reads the
// caller's real session cookies (via `resolveRouteSession`) on every request.
export const dynamic = "force-dynamic";

/**
 * `GET /api/campaign-health/:campaignId` — proxies `GET /api/v1/campaign-health/:campaignId`
 * (EYVRA — SAMANTHA V2 Phase 3/4: real, deterministic `CampaignHealth`/`CampaignDiagnosis`/
 * `SamanthaDecision`, computed WITHOUT any LLM call). Unlike `andromeda-health/route.ts`, this
 * real backend endpoint is its own top-level `api/v1/campaign-health` route, NOT nested under
 * `api/v1/campaigns/:campaignId` — see `campaign-health.controller.ts`'s own `@Controller` path —
 * and it takes no `adAccountId`/`datePreset` query passthrough. `:campaignId` here is the real
 * `meta_campaign_id` (same convention `campaign-health.controller.ts`'s own doc comment states),
 * so callers must pass `campaign.metaId`, never the internal `campaign.id`.
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
    const data = await callAaosApi<CampaignHealthResponseDto>(
      `/api/v1/campaign-health/${encodeURIComponent(params.campaignId)}`,
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
