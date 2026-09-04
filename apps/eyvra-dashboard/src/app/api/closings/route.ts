import { NextResponse } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { ClosingDto } from "@/types/dashboard.types";

/**
 * `GET /api/closings` — proxies `aaos-api`'s real `GET /api/v1/closings`. Unlike `/api/leads`
 * (which fans out across every branch because `aaos-api`'s leads endpoint requires a branchId),
 * `GetClosingsQuerySchema.branchId` is optional — one call with no query params already returns
 * every branch's closings, so no fan-out is needed here.
 *
 * `aaos-api`'s `ClosingsService.getClosings` defaults `fromDate` to the start of the current
 * calendar month when the caller passes none — exactly the "bulan ini" scope the Overview page's
 * KPI strip (Test Drive/SPK/Komisi Total) needs, so this route passes no date params through by
 * default rather than reimplementing that default client-side.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const data = await callAaosApi<readonly ClosingDto[]>("/api/v1/closings");
    return NextResponse.json({ closings: data });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
