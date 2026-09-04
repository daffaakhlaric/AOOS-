import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { SettingsDto } from "@/types/tenant.types";

// Reads the caller's real session cookies on every request (via `resolveRouteSession`) — Next.js's
// static analysis doesn't detect that from a plain `request.cookies` read (unlike `next/headers`'s
// `cookies()`), so this GET handler must be explicitly marked dynamic or `next build` tries to
// statically prerender it at build time (and fails, since there's no real request/cookies then).
export const dynamic = "force-dynamic";

/** `GET /api/settings` — proxies `GET /api/v1/settings`, forwarding `x-tenant-id: session.tenantId` (coordinator note section 2's real per-request tenant header). */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  try {
    const data = await callAaosApi<SettingsDto>("/api/v1/settings", {
      headers: { "x-tenant-id": session.tenantId },
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
