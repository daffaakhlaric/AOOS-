import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { PacingResponseDto } from "@/types/growth-objective.types";

// See `app/api/settings/route.ts`'s comment on this same export — this handler also reads the
// caller's real session cookies (via `resolveRouteSession`) on every request.
export const dynamic = "force-dynamic";

/**
 * `GET /api/growth-objectives/:id/pacing` — proxies `aaos-api`'s real
 * `GET /api/v1/growth-objectives/:id/pacing` (EYVRA — SAMANTHA V2 Phase 16). Mirrors
 * `campaign-health/[campaignId]/route.ts`'s single-GET shape. A real read, no status restriction
 * (see `GrowthObjectivesController.pacing`) — unlike `/analyze`/`/activate`/`/check-progress`,
 * legal to call regardless of the objective's current `status`.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }

  try {
    const data = await callAaosApi<PacingResponseDto>(
      `/api/v1/growth-objectives/${encodeURIComponent(params.id)}/pacing`,
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
