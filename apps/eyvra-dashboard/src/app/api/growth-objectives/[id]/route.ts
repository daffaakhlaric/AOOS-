import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { GrowthObjectiveResponseDto } from "@/types/growth-objective.types";

// See `app/api/settings/route.ts`'s comment on this same export — this handler also reads the
// caller's real session cookies (via `resolveRouteSession`) on every request.
export const dynamic = "force-dynamic";

/**
 * `GET /api/growth-objectives/:id` — proxies `GET /api/v1/growth-objectives/:id` (EYVRA —
 * SAMANTHA V2 Phase 15 read-only detail view). Mirrors `campaign-health/[campaignId]/route.ts`'s
 * single-GET shape. `POST /:id/activate`, `/:id/analyze`, `/:id/check-progress` and
 * `GET /:id/pacing` are real, already-shipped backend actions but wiring their UI triggers is
 * explicitly out of scope this phase (Phase 16).
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
    const data = await callAaosApi<GrowthObjectiveResponseDto>(
      `/api/v1/growth-objectives/${encodeURIComponent(params.id)}`,
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
