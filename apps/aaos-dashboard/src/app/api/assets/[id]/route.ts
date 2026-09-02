import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { AssetDto } from "@/types/dashboard.types";

// See `app/api/settings/route.ts`'s comment on this same export — this GET handler also reads
// the caller's real session cookies on every request.
export const dynamic = "force-dynamic";

/**
 * `GET /api/assets/:id` — proxies `GET /api/v1/assets/:id` (asset-detail modal).
 *
 * TENANT-SCOPING FIX (Phase T1): forwards `x-tenant-id: session.tenantId` (mirrors
 * `api/listings/route.ts`'s exact pattern) — see `app/api/assets/route.ts`'s doc note. `aaos-api`'s
 * `byId` does not itself filter by tenant today (its underlying `GetAsset` use case has no tenantId
 * parameter — a separate, deeper gap out of scope for this phase), but the header is forwarded
 * consistently on every real `/api/assets/*` proxy call regardless.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  try {
    const data = await callAaosApi<AssetDto>(`/api/v1/assets/${encodeURIComponent(params.id)}`, {
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

/**
 * `DELETE /api/assets/:id` — proxies `DELETE /api/v1/assets/:id`, which ARCHIVES the asset
 * (`AssetStatus.ARCHIVED`) and keeps both the DB row and the GCS object. There is no hard delete
 * anywhere in this domain — `IAssetRepository` has no `delete` method — which is why the UI labels
 * this "Arsipkan", not "Hapus permanen". The updated asset is returned so the caller can see the
 * real new status rather than a `{ deleted: true }` that would misdescribe what happened.
 *
 * TENANT-SCOPING FIX (Phase T1): forwards `x-tenant-id: session.tenantId` — see GET above's note.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  try {
    const data = await callAaosApi<AssetDto>(`/api/v1/assets/${encodeURIComponent(params.id)}`, {
      method: "DELETE",
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
