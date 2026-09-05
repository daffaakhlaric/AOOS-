import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { AuditLogDto } from "@/types/audit-log.types";

export const dynamic = "force-dynamic";

/** `GET /api/audit-log` — proxies `GET /api/v1/audit-log` (AAOS LOOP UPGRADE, Sprint 6 Prompt 17). */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  const agent = request.nextUrl.searchParams.get("agent");
  try {
    const data = await callAaosApi<readonly AuditLogDto[]>(
      `/api/v1/audit-log${agent !== null ? `?agent=${encodeURIComponent(agent)}` : ""}`,
      { headers: { "x-tenant-id": session.tenantId } },
    );
    return NextResponse.json({ entries: data });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
