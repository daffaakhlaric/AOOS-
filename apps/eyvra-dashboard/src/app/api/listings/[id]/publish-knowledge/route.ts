import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { ListingDto } from "@/types/listing.types";

/** `POST /api/listings/:id/publish-knowledge` — proxies `POST /api/v1/listings/:id/publish-knowledge` (Listing Detail's "📚 Jadikan Knowledge Samantha"). */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  try {
    const data = await callAaosApi<ListingDto>(
      `/api/v1/listings/${encodeURIComponent(params.id)}/publish-knowledge`,
      { method: "POST", headers: { "x-tenant-id": session.tenantId } },
    );
    return NextResponse.json({ listing: data });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
