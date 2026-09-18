import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { AssessmentComparisonResponseDto } from "@/types/campaign-health.types";

// See `app/api/settings/route.ts`'s comment on this same export — this handler also reads the
// caller's real session cookies (via `resolveRouteSession`) on every request.
export const dynamic = "force-dynamic";

/**
 * `GET /api/campaign-health/:campaignId/compare-latest` — proxies `aaos-api`'s real
 * `GET /api/v1/campaign-health/:campaignId/compare-latest` (EYVRA — SAMANTHA V2 Phase 10's
 * already-shipped backend endpoint, surfaced to the frontend for the first time in Phase 18).
 * Returns the real discriminated `AssessmentComparisonResponseDto` unchanged — `{available:
 * false, reason}` is an honest, expected state (fewer than 2 recorded assessments exist yet), NOT
 * an error, so it is passed straight through with a `200`, mirroring
 * `campaign-health/[campaignId]/route.ts`'s exact shape for the sibling `GET /:campaignId` route.
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
    const data = await callAaosApi<AssessmentComparisonResponseDto>(
      `/api/v1/campaign-health/${encodeURIComponent(params.campaignId)}/compare-latest`,
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
