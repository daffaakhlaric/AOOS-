import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { SimulationStatusDto } from "@/types/dashboard.types";

export const dynamic = "force-dynamic";

/**
 * `POST /api/simulation/:id/pause` — proxies `POST /api/v1/simulation/:id/pause` (AAOS-GO-LIVE,
 * Phase 4) — the `/go-live` monitoring panel's `[⏸ Pause]` button. Forwards
 * `x-tenant-id: session.tenantId` (coordinator note section 9).
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
    const data = await callAaosApi<SimulationStatusDto>(
      `/api/v1/simulation/${encodeURIComponent(params.id)}/pause`,
      { method: "POST", body: {}, headers: { "x-tenant-id": session.tenantId } },
    );
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
