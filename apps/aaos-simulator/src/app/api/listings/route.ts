import { NextResponse, type NextRequest } from "next/server";

import { fetchActiveListings } from "@/lib/aaos-api-client";
import type { FetchActiveListingsResponse } from "@/types/simulator.types";

/**
 * `GET /api/listings?tenantId=...` — real active-listing list for the PROPERTY listing picker
 * (task point 3). Same server-side proxy reasoning as `GET /api/tenants` — a `"use client"`
 * component can never read `AAOS_API_BASE_URL`/`AAOS_API_KEY` directly. Always responds 200 on a
 * well-formed request (`fetchActiveListings` never throws); 400 only for the one genuinely
 * malformed-request case (`tenantId` missing from the query string).
 */
export async function GET(
  request: NextRequest,
): Promise<
  NextResponse<FetchActiveListingsResponse | { readonly error: { readonly message: string } }>
> {
  const tenantId = request.nextUrl.searchParams.get("tenantId");
  if (tenantId === null || tenantId.length === 0) {
    return NextResponse.json(
      { error: { message: '"tenantId" query parameter is required.' } },
      { status: 400 },
    );
  }
  const result = await fetchActiveListings(tenantId);
  return NextResponse.json(result, { status: 200 });
}
