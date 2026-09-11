import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { AndromedaHealthDto } from "@/types/andromeda-health.types";

// See `app/api/settings/route.ts`'s comment on this same export — this handler also reads the
// caller's real session cookies (via `resolveRouteSession`) on every request.
export const dynamic = "force-dynamic";

/**
 * `GET /api/campaigns/:campaignId/andromeda-health` — proxies
 * `GET /api/v1/campaigns/:campaignId/andromeda-health` (Samantha Andromeda-Aware Campaign System,
 * Sprint 2). Same `adAccountId?`/`datePreset?` query passthrough `app/api/analytics/assets/[id]/
 * route.ts` already establishes.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { campaignId: string } },
): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  const adAccountId = request.nextUrl.searchParams.get("adAccountId") ?? undefined;
  const datePreset = request.nextUrl.searchParams.get("datePreset") ?? undefined;

  try {
    const data = await callAaosApi<AndromedaHealthDto>(
      `/api/v1/campaigns/${encodeURIComponent(params.campaignId)}/andromeda-health`,
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
