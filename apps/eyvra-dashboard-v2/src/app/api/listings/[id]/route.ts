import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { ListingDto } from "@/types/dashboard.types";

export const dynamic = "force-dynamic";

/**
 * `GET /api/listings/:id` — thin proxy to aaos-api's real `GET /api/v1/listings/:id`
 * (`ListingsController.byId`). Second link of the real Campaign->Listing->photo chain: the response
 * carries the listing's real `photos[]` plus the server-computed real `mainPhotoUrl`, which is
 * absent when the listing genuinely has no photos.
 *
 * Read-only on purpose — this app never mutates listings, so no PUT/DELETE here (unlike
 * apps/eyvra-dashboard's own Listing Manager route). Same
 * `resolveRouteSession -> 401 -> callAaosApi(x-tenant-id) -> JSON passthrough` convention as every
 * other proxy route in this app.
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
    const data = await callAaosApi<ListingDto>(
      `/api/v1/listings/${encodeURIComponent(params.id)}`,
      { headers: { "x-tenant-id": session.tenantId } },
    );
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
