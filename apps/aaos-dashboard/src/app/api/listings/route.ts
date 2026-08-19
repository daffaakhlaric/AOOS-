import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { CreateListingInput, ListingDto, ListingListDto } from "@/types/listing.types";

// See `app/api/settings/route.ts`'s comment on this same export — this GET handler also reads
// the caller's real session cookies on every request.
export const dynamic = "force-dynamic";

/** `GET/POST /api/listings` — proxies `GET/POST /api/v1/listings` (Listing Manager grid + [+ Tambah Listing]). */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  const url = new URL(request.url);
  try {
    const data = await callAaosApi<ListingListDto>("/api/v1/listings", {
      headers: { "x-tenant-id": session.tenantId },
      searchParams: {
        status: url.searchParams.get("status") ?? undefined,
        propertyType: url.searchParams.get("propertyType") ?? undefined,
        search: url.searchParams.get("search") ?? undefined,
      },
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  const body: unknown = await request.json().catch(() => ({}));
  try {
    const data = await callAaosApi<ListingDto>("/api/v1/listings", {
      method: "POST",
      body: body as CreateListingInput,
      headers: { "x-tenant-id": session.tenantId },
    });
    return NextResponse.json({ listing: data });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
