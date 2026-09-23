import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { OverviewTimeseriesResponseDto } from "@/types/dashboard.types";

export const dynamic = "force-dynamic";

/** `GET /api/overview/timeseries` — thin proxy to aaos-api's real `GET /api/v1/overview/timeseries`. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  const days = request.nextUrl.searchParams.get("days") ?? undefined;
  try {
    const data = await callAaosApi<OverviewTimeseriesResponseDto>("/api/v1/overview/timeseries", {
      headers: { "x-tenant-id": session.tenantId },
      searchParams: { days },
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
