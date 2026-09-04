import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { SimulationStatusDto } from "@/types/dashboard.types";

export const dynamic = "force-dynamic";

/**
 * `POST /api/simulation/:id/approve` — proxies `POST /api/v1/simulation/:id/approve`. HARD SCOPE
 * BOUNDARY (see `docs/PROMPT-AAOS-DASHBOARD-SIMULASI-TAMARA-KAI-JESSY.md`): this only records the
 * manager's decision on the simulation record — it never calls `/api/verdicts`, never creates a
 * Meta campaign, never touches WhatsApp/CAPI. A manager who wants to actually act on a verdict
 * already has a real way to do that on `/meta-ads/strategi` (`StrategiClient.tsx`). Forwards
 * `x-tenant-id: session.tenantId`, same as every other Simulasi proxy route (coordinator note
 * section 9) — see `history/route.ts`'s doc for why this is sent even where `aaos-api` doesn't
 * read it yet.
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
      `/api/v1/simulation/${encodeURIComponent(params.id)}/approve`,
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
