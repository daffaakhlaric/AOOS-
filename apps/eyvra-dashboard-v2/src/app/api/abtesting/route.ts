import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { AbTestDto } from "@/types/dashboard.types";

export const dynamic = "force-dynamic";

/** `GET /api/abtesting` — thin proxy to aaos-api's real `GET /api/v1/abtesting`, forwarding `status`. Backs the "Active Experiments" widget. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  const status = request.nextUrl.searchParams.get("status") ?? undefined;
  try {
    const tests = await callAaosApi<readonly AbTestDto[]>("/api/v1/abtesting", {
      searchParams: { status },
      headers: { "x-tenant-id": session.tenantId },
    });
    return NextResponse.json({ tests });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
