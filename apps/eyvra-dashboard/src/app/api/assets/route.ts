import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { AssetListDto } from "@/types/dashboard.types";

// See `app/api/settings/route.ts`'s comment on this same export — this GET handler also reads
// the caller's real session cookies on every request.
export const dynamic = "force-dynamic";

/**
 * `GET /api/assets` — proxies `GET /api/v1/assets`, forwarding only the filters the caller set.
 * `aaos-api` re-validates each against the REAL `AssetType`/`AssetStatus`/`Branch` enums
 * (`GetAssetsQuerySchema`), so a fabricated value is rejected upstream with a 422 rather than
 * quietly dropped here. "Semua" is expressed by omitting `type`, never by an invented `ALL` value.
 *
 * TENANT-SCOPING FIX (Phase T1): forwards `x-tenant-id: session.tenantId` (mirrors
 * `api/listings/route.ts`'s exact pattern) so `aaos-api`'s `AssetsController` — now real
 * `@TenantId()`-scoped — sees the caller's actual tenant instead of the single, process-wide
 * `AAOS_TENANT_ID` env var every browser session used to fall back to.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  const url = new URL(request.url);
  const searchParams: Record<string, string | undefined> = {
    type: url.searchParams.get("type") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    branch: url.searchParams.get("branch") ?? undefined,
    unitId: url.searchParams.get("unitId") ?? undefined,
    // AAOS-CREATIVE-REVIEW — case-insensitive `unit_model` filter (the creative photo picker's
    // "xpander"/"hrv"/"avanza" chips). Free text, re-validated upstream by `GetAssetsQuerySchema`.
    model: url.searchParams.get("model") ?? undefined,
    search: url.searchParams.get("search") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    sort: url.searchParams.get("sort") ?? undefined,
  };

  try {
    const data = await callAaosApi<AssetListDto>("/api/v1/assets", {
      headers: { "x-tenant-id": session.tenantId },
      searchParams,
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
