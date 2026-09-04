import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";

interface StartSimulationResponse {
  readonly id: string;
  readonly status: "RUNNING";
}

// See `api/settings/route.ts`'s class doc: reads the caller's real session cookies on every
// request, so this handler must be explicitly marked dynamic.
export const dynamic = "force-dynamic";

/**
 * `POST /api/simulation/start` — proxies `POST /api/v1/simulation/start`, forwarding
 * `x-tenant-id: session.tenantId` (AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 5, coordinator note
 * section 9 — the same real per-request tenant header `api/settings/route.ts` already forwards).
 * `aaos-api`'s `SimulationController.start` reads it via `@TenantId()` to resolve the real tenant
 * and its vertical for the rest of the pipeline. Returns immediately with a `simulationId` — the
 * real pipeline runs detached on `aaos-api`; the wizard polls `/api/simulation/:id/status` for
 * progress (coordinator note #8, never a synchronous multi-minute request).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  const body: unknown = await request.json().catch(() => undefined);
  try {
    const data = await callAaosApi<StartSimulationResponse>("/api/v1/simulation/start", {
      method: "POST",
      body,
      headers: { "x-tenant-id": session.tenantId },
    });
    return NextResponse.json(data, { status: 202 });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
