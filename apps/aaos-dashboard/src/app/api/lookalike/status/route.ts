import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { LookalikeStatusDto } from "@/types/dashboard.types";

// See `app/api/settings/route.ts`'s comment on this same export — this handler also reads the
// caller's real session cookies (via `resolveRouteSession`) on every request.
export const dynamic = "force-dynamic";

/**
 * `GET /api/lookalike/status` — proxies `aaos-api`'s real `GET /api/v1/lookalike/status`.
 *
 * TENANT-SCOPING FIX (Phase T2, docs/PROMPT-AAOS-META-ADS-TENANT-SCOPING.md): forwards
 * `x-tenant-id: session.tenantId` (same `resolveRouteSession`/`callAaosApi` pattern
 * `api/listings/route.ts` already establishes) — this proxy previously called `aaos-api` with no
 * tenant header at all, now that `LookalikeController` reads one.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  try {
    const status = await callAaosApi<LookalikeStatusDto>("/api/v1/lookalike/status", {
      headers: { "x-tenant-id": session.tenantId },
    });
    return NextResponse.json({ status });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
