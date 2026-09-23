import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { PendingActionDto } from "@/types/dashboard.types";

export const dynamic = "force-dynamic";

/**
 * `GET /api/pending-actions` — thin proxy to aaos-api's real `GET /api/v1/pending-actions`
 * (`PendingActionsController.list`). Backs the Topbar's Pending Approvals trigger + the
 * PendingApprovalDrawer's content with a REAL count/list — no fabricated "5 Approvals" badge.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  const status = request.nextUrl.searchParams.get("status") ?? undefined;
  try {
    const actions = await callAaosApi<readonly PendingActionDto[]>("/api/v1/pending-actions", {
      searchParams: { status },
      headers: { "x-tenant-id": session.tenantId },
    });
    return NextResponse.json({ actions });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
