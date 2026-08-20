import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { SimulationStatusDto } from "@/types/dashboard.types";

export const dynamic = "force-dynamic";

/**
 * `POST /api/simulation/:id/go-live` — proxies `POST /api/v1/simulation/:id/go-live` (AAOS-GO-LIVE,
 * Phase 4). This proxy does NOT re-check the confirmation text or any guard — the real enforcement
 * (confirmation === "GO LIVE", decision === APPROVED, score/budget/rate-limit) is server-side in
 * `apps/aaos-api`'s `GoLiveService.execute`, per coordinator note section 6 ("a direct API call
 * must not bypass it even if some UI layer already checked it"). This route only forwards the
 * body/response and translates `AaosApiError` into a real HTTP status the client can render.
 * Forwards `x-tenant-id: session.tenantId` (coordinator note section 9).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  const body: unknown = await request.json().catch(() => ({}));
  try {
    const data = await callAaosApi<SimulationStatusDto>(
      `/api/v1/simulation/${encodeURIComponent(params.id)}/go-live`,
      { method: "POST", body: body ?? {}, headers: { "x-tenant-id": session.tenantId } },
    );
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
