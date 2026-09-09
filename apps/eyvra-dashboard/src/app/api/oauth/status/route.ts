import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { OAuthStatusDto } from "@/types/tenant.types";

// Same real "must be explicitly marked dynamic or `next build` tries to statically prerender it"
// requirement every other session-reading GET route in this app already documents (see
// `/api/settings/route.ts`'s own comment) — this GET handler reads the caller's real session
// cookies via `resolveRouteSession` on every request.
export const dynamic = "force-dynamic";

/**
 * `GET /api/oauth/status` — proxies `apps/aaos-api`'s real `GET /oauth/status/:tenantId`
 * (`MetaOAuthController.status`, built in Sprint 2). Unlike `/api/settings/*`'s
 * `x-tenant-id`-header convention, `/oauth/*` routes take `tenantId` as an explicit path/query
 * parameter (see `MetaOAuthController`'s own class doc) — this proxy bridges the two conventions
 * so the "Koneksi" tab's client code never needs to know the difference.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  try {
    const data = await callAaosApi<OAuthStatusDto>(
      `/oauth/status/${encodeURIComponent(session.tenantId)}`,
    );
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
