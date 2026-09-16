import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { CampaignHistoryResponseDto } from "@/types/dashboard.types";

// See `app/api/settings/route.ts`'s comment on this same export — this handler also reads the
// caller's real session cookies (via `resolveRouteSession`) on every request.
export const dynamic = "force-dynamic";

/**
 * `GET /api/campaigns/:campaignId/history` — Campaign Page Rebuild v2. Proxies
 * `GET /api/v1/campaigns/:campaignId/history` (real, already-persisted `meta_insights_daily`
 * read-back for sparklines/trend displays) — same shape `app/api/campaigns/[campaignId]/
 * andromeda-health/route.ts` already establishes.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { campaignId: string } },
): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  const days = request.nextUrl.searchParams.get("days") ?? undefined;

  try {
    const data = await callAaosApi<CampaignHistoryResponseDto>(
      `/api/v1/campaigns/${encodeURIComponent(params.campaignId)}/history`,
      { searchParams: { days }, headers: { "x-tenant-id": session.tenantId } },
    );
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
