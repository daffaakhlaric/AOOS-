import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, postFormDataToAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { ListingDto } from "@/types/listing.types";

export const dynamic = "force-dynamic";

/**
 * `POST /api/listings/:id/photos` — proxies `POST /api/v1/listings/:id/photos` (Listing modal's
 * drag&drop photo upload). Reads the browser's real `multipart/form-data` request body and
 * forwards it to `apps/aaos-api` unmodified via `postFormDataToAaosApi` — the file bytes are never
 * buffered into a base64 JSON string, matching the real `@fastify/multipart` contract
 * `ListingsController.uploadPhoto` expects on the other end.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  const formData = await request.formData();
  try {
    const data = await postFormDataToAaosApi<ListingDto>(
      `/api/v1/listings/${encodeURIComponent(params.id)}/photos`,
      formData,
      { "x-tenant-id": session.tenantId },
    );
    return NextResponse.json({ listing: data });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
