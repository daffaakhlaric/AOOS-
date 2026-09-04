import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";

// See `app/api/settings/route.ts`'s comment on this same export — this handler also reads the
// caller's real session cookies (via `resolveRouteSession`) on every request.
export const dynamic = "force-dynamic";

/**
 * `POST /api/verdicts` — proxies `POST /api/v1/verdicts` (a real `aaos-api` endpoint that
 * pre-dates AAOS-W4A; not one of this task's 7 new endpoints, but the dashboard's "⚡ Execute"
 * button needs somewhere real to call).
 *
 * TENANT-SCOPING FIX (Phase T2, docs/PROMPT-AAOS-META-ADS-TENANT-SCOPING.md): forwards
 * `x-tenant-id: session.tenantId` — this proxy previously called `aaos-api` with no tenant header
 * at all, now that `MetaAdsController.postVerdict` reads one.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  const body: unknown = await request.json().catch(() => undefined);
  try {
    const data = await callAaosApi<{ readonly action: string }>("/api/v1/verdicts", {
      method: "POST",
      body,
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
