import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { LeadDetailDto } from "@/types/dashboard.types";

export const dynamic = "force-dynamic";

/**
 * `GET /api/leads/:leadId` — proxies `aaos-api`'s `GET /api/v1/leads/:id`. Powers `/leads/[leadId]`,
 * the manager chat room (AAOS-CHAT-ROOM-CLARA).
 *
 * PROPERTY-TENANT-ISOLATION Phase 1 (security fix): forwards the real logged-in session's
 * `tenantId` as `x-tenant-id`, same convention as `modules/settings`'s proxy routes.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { leadId: string } },
): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  try {
    const lead = await callAaosApi<LeadDetailDto>(
      `/api/v1/leads/${encodeURIComponent(params.leadId)}`,
      { headers: { "x-tenant-id": session.tenantId } },
    );
    return NextResponse.json(lead);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
