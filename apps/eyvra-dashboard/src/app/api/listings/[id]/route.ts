import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { ListingDto, UpdateListingInput } from "@/types/listing.types";

export const dynamic = "force-dynamic";

/** `GET/PUT/DELETE /api/listings/:id` — proxies `GET/PUT/DELETE /api/v1/listings/:id` (Listing Detail page + a card's [Edit]). */
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
    return NextResponse.json({ listing: data });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}

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
      `/api/v1/listings/${encodeURIComponent(params.id)}`,
      {
        method: "PUT",
        body: body as UpdateListingInput,
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  try {
    await callAaosApi<{ readonly deleted: true }>(
      `/api/v1/listings/${encodeURIComponent(params.id)}`,
      { method: "DELETE", headers: { "x-tenant-id": session.tenantId } },
    );
    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
