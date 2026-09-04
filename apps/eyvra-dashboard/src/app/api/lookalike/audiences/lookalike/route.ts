import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { MetaAudienceDto } from "@/types/dashboard.types";

// See `app/api/settings/route.ts`'s comment on this same export — this handler also reads the
// caller's real session cookies (via `resolveRouteSession`) on every request.
export const dynamic = "force-dynamic";

/**
 * `POST /api/lookalike/audiences/lookalike` — proxies `aaos-api`'s real
 * `POST /api/v1/lookalike/audiences/lookalike` ("+ Buat Lookalike N%" buttons).
 *
 * TENANT-SCOPING FIX (Phase T2): forwards `x-tenant-id: session.tenantId` — see
 * `../../status/route.ts`'s own doc for the full rationale.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { percentage?: 1 | 2 | 3 };
  try {
    const audience = await callAaosApi<MetaAudienceDto>("/api/v1/lookalike/audiences/lookalike", {
      method: "POST",
      body,
      headers: { "x-tenant-id": session.tenantId },
    });
    return NextResponse.json({ audience }, { status: 201 });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
