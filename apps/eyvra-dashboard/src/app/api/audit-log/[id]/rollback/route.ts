import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { AuditLogDto } from "@/types/audit-log.types";

export const dynamic = "force-dynamic";

/**
 * `POST /api/audit-log/:id/rollback` — proxies `POST /api/v1/audit-log/:id/rollback`
 * (AAOS LOOP UPGRADE, Sprint 6 Prompt 17). Forwards the caller's real session email as `decidedBy`
 * — same "never fabricate an actor" discipline every other decision-forwarding route in this app
 * already establishes.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  try {
    const data = await callAaosApi<AuditLogDto>(
      `/api/v1/audit-log/${encodeURIComponent(params.id)}/rollback`,
      {
        method: "POST",
        body: { ...(session.email !== undefined ? { decidedBy: session.email } : {}) },
        headers: { "x-tenant-id": session.tenantId },
      },
    );
    return NextResponse.json({ entry: data });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
