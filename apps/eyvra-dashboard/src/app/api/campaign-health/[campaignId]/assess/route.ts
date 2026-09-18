import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { CampaignHealthResponseDto } from "@/types/campaign-health.types";

// See `app/api/settings/route.ts`'s comment on this same export — this handler also reads the
// caller's real session cookies (via `resolveRouteSession`) on every request.
export const dynamic = "force-dynamic";

/**
 * `POST /api/campaign-health/:campaignId/assess` — proxies `aaos-api`'s real
 * `POST /api/v1/campaign-health/:campaignId/assess` (EYVRA — SAMANTHA V2 Phase 18 "Rekam
 * Assessment Ini" button). No request body — the real backend endpoint takes none (same
 * "compute-and-persist" shape `growth-objectives/[id]/analyze/route.ts` already proxies for
 * `GrowthObjectivesController.analyze`). This is the ONLY frontend surface that ever calls the
 * real, persisting `.../assess` endpoint — the plain `GET /:campaignId` this app already calls on
 * every `/campaigns` page load (`campaign-health/[campaignId]/route.ts`) never writes a
 * `samantha_campaign_assessments` row, so without this trigger `compare-latest`'s trend data could
 * never accumulate real history.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { campaignId: string } },
): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }

  try {
    const data = await callAaosApi<CampaignHealthResponseDto>(
      `/api/v1/campaign-health/${encodeURIComponent(params.campaignId)}/assess`,
      { method: "POST", headers: { "x-tenant-id": session.tenantId } },
    );
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
