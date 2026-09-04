import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { SimulationHistoryEntryDto } from "@/types/dashboard.types";

export const dynamic = "force-dynamic";

/**
 * `GET /api/simulation/history` — proxies `GET /api/v1/simulation/history`, backs the wizard's
 * "Riwayat" tab. Forwards `x-tenant-id: session.tenantId` (AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY
 * Phase 5, coordinator note section 9), same as `[simulation/]start/route.ts` — `aaos-api`'s
 * `SimulationController.history` doesn't read it yet (out of this phase's explicit scope), but
 * sending it now keeps every Simulasi proxy route consistent and forward-compatible.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  try {
    const data = await callAaosApi<readonly SimulationHistoryEntryDto[]>(
      "/api/v1/simulation/history",
      { headers: { "x-tenant-id": session.tenantId } },
    );
    return NextResponse.json({ history: data });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
