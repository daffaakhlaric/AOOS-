import { NextResponse } from "next/server";

import { fetchTenants } from "@/lib/aaos-api-client";
import type { FetchTenantsResponse } from "@/types/simulator.types";

/**
 * `GET /api/tenants` — real tenant list for the simulator/report tenant selector (task point 1).
 * Thin server-side proxy to `apps/aaos-api`'s `GET /api/v1/superadmin/tenants` via
 * `src/lib/aaos-api-client.ts`'s `fetchTenants` — exists only because `AAOS_API_BASE_URL`/
 * `AAOS_API_KEY` are server-only env vars a `"use client"` component can never read directly
 * (same reason `/api/simulate` exists rather than having `SimulatorClient` call `apps/aaos-api`
 * itself). Always responds 200 — `fetchTenants` never throws, and an honest `{ ok: false, reason }`
 * body IS the correct response for "the real call failed", not an HTTP error status, so the client
 * selector can render a clear degraded message rather than a generic fetch-failure state.
 */
export async function GET(): Promise<NextResponse<FetchTenantsResponse>> {
  const result = await fetchTenants();
  return NextResponse.json(result, { status: 200 });
}
