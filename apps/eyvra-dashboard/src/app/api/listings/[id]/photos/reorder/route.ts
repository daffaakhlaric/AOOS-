import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { ListingDto } from "@/types/listing.types";

export interface ReorderPhotosInput {
  readonly photoIds: readonly string[];
  readonly mainPhotoId?: string;
}

/** `PUT /api/listings/:id/photos/reorder` — proxies `PUT /api/v1/listings/:id/photos/reorder` (drag-to-reorder + "set foto utama" ⭐). */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  const body: unknown = await request.json().catch(() => ({}));
  try {
    const data = await callAaosApi<ListingDto>(
      `/api/v1/listings/${encodeURIComponent(params.id)}/photos/reorder`,
      {
        method: "PUT",
        body: body as ReorderPhotosInput,
        headers: { "x-tenant-id": session.tenantId },
      },
    );
    return NextResponse.json({ listing: data });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
