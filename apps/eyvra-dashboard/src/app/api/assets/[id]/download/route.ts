import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { AssetDownloadDto } from "@/types/dashboard.types";

// See `app/api/settings/route.ts`'s comment on this same export — this GET handler also reads
// the caller's real session cookies on every request.
export const dynamic = "force-dynamic";

/**
 * `GET /api/assets/:id/download` — proxies `GET /api/v1/assets/:id/download`, which returns a real,
 * time-limited GCS V4 signed read URL. Passed back to the client as JSON (not as a redirect) so the
 * client component can open it in a new tab itself; the signed URL is what the browser then hits
 * directly, never `aaos-api`.
 *
 * TENANT-SCOPING FIX (Phase T1): forwards `x-tenant-id: session.tenantId` (mirrors
 * `api/listings/route.ts`'s exact pattern) — see `app/api/assets/[id]/route.ts`'s GET doc note on
 * why this is forwarded consistently even though `aaos-api`'s `download` does not yet filter by it.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  const expiresIn = new URL(request.url).searchParams.get("expiresIn") ?? undefined;
  try {
    const data = await callAaosApi<AssetDownloadDto>(
      `/api/v1/assets/${encodeURIComponent(params.id)}/download`,
      { headers: { "x-tenant-id": session.tenantId }, searchParams: { expiresIn } },
    );
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
