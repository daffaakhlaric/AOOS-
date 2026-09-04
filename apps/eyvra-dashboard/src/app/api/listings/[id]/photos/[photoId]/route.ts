import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { ListingDto } from "@/types/listing.types";

/** `DELETE /api/listings/:id/photos/:photoId` — proxies `DELETE /api/v1/listings/:id/photos/:photoId`. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; photoId: string } },
): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  try {
    const data = await callAaosApi<ListingDto>(
      `/api/v1/listings/${encodeURIComponent(params.id)}/photos/${encodeURIComponent(params.photoId)}`,
      { method: "DELETE", headers: { "x-tenant-id": session.tenantId } },
    );
    return NextResponse.json({ listing: data });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
