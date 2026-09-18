import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { GrowthObjectiveResponseDto } from "@/types/growth-objective.types";

// See `app/api/settings/route.ts`'s comment on this same export — this handler also reads the
// caller's real session cookies (via `resolveRouteSession`) on every request.
export const dynamic = "force-dynamic";

/**
 * `POST /api/growth-objectives/:id/check-progress` — proxies `aaos-api`'s real
 * `POST /api/v1/growth-objectives/:id/check-progress` (EYVRA — SAMANTHA V2 Phase 16 "Cek
 * Progress" button). No request body — the real backend endpoint takes none (see
 * `GrowthObjectivesController.checkProgress`). Legal only from `ACTIVE`/`ON_TRACK`/`AT_RISK`/
 * `OFF_TRACK` status; an illegal-transition call surfaces the real upstream `AaosApiError`
 * message here, same as every other proxy in this app.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  try {
    const data = await callAaosApi<GrowthObjectiveResponseDto>(
      `/api/v1/growth-objectives/${encodeURIComponent(params.id)}/check-progress`,
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
