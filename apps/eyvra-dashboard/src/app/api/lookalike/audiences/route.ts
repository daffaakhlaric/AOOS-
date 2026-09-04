import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { MetaAudienceDto } from "@/types/dashboard.types";

// See `app/api/settings/route.ts`'s comment on this same export — this handler also reads the
// caller's real session cookies (via `resolveRouteSession`) on every request.
export const dynamic = "force-dynamic";

/**
 * `GET /api/lookalike/audiences` — proxies `aaos-api`'s real `GET /api/v1/lookalike/audiences`.
 *
 * TENANT-SCOPING FIX (Phase T2): forwards `x-tenant-id: session.tenantId` — see
 * `../status/route.ts`'s own doc for the full rationale.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  try {
    const audiences = await callAaosApi<readonly MetaAudienceDto[]>("/api/v1/lookalike/audiences", {
      headers: { "x-tenant-id": session.tenantId },
    });
    return NextResponse.json({ audiences });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
