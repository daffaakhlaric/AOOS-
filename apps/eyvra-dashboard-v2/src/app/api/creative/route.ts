import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { CreativePackageDto } from "@/types/dashboard.types";

export const dynamic = "force-dynamic";

/** `GET /api/creative` — thin proxy to aaos-api's real `GET /api/v1/creative-packages`. Backs the "Kai Production" widget (counted by status client-side, same approach apps/eyvra-dashboard's KaiProductionSummaryCard uses). */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  const limit = request.nextUrl.searchParams.get("limit") ?? undefined;
  const status = request.nextUrl.searchParams.get("status") ?? undefined;
  try {
    const data = await callAaosApi<readonly CreativePackageDto[]>("/api/v1/creative-packages", {
      searchParams: { status, limit },
      headers: { "x-tenant-id": session.tenantId },
    });
    return NextResponse.json({ packages: data });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
