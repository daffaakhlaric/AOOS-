import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { MessagesPageDto } from "@/types/dashboard.types";

export const dynamic = "force-dynamic";

/**
 * `GET /api/leads/:leadId/messages?page=&limit=&order=` — proxies `aaos-api`'s real, paginated
 * `GET /api/v1/leads/:id/messages` (MENU RESTRUCTURE FINAL `/clara/inbox`, coordinator note #2).
 * Query params are forwarded verbatim — `aaos-api`'s `GetMessagesQuerySchema` already coerces/
 * bounds/defaults them.
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
  const page = request.nextUrl.searchParams.get("page") ?? undefined;
  const limit = request.nextUrl.searchParams.get("limit") ?? undefined;
  const order = request.nextUrl.searchParams.get("order") ?? undefined;

  try {
    const messagesPage = await callAaosApi<MessagesPageDto>(
      `/api/v1/leads/${encodeURIComponent(params.leadId)}/messages`,
      { searchParams: { page, limit, order }, headers: { "x-tenant-id": session.tenantId } },
    );
    return NextResponse.json(messagesPage);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
