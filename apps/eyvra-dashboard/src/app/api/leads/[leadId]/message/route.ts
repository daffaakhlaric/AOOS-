import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { MessageDto } from "@/types/dashboard.types";

export const dynamic = "force-dynamic";

interface SendMessageBody {
  readonly salesHumanId: string;
  readonly salesName: string;
  readonly message: string;
}

/**
 * `POST /api/leads/:leadId/message` — proxies `aaos-api`'s real `POST /api/v1/leads/:id/message`,
 * a sales human's real reply sent via the real WhatsApp connector (MENU RESTRUCTURE FINAL
 * `/clara/inbox`'s "Reply as: Sales Human" toggle, coordinator note #2). `aaos-api` itself
 * validates `salesHumanId` matches the lead's real, currently-assigned sales human (403 otherwise)
 * — this proxy adds no extra check of its own.
 *
 * PROPERTY-TENANT-ISOLATION Phase 1 (security fix): forwards the real logged-in session's
 * `tenantId` as `x-tenant-id`, same convention as `modules/settings`'s proxy routes.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { leadId: string } },
): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  const body = (await request.json()) as SendMessageBody;
  try {
    const message = await callAaosApi<MessageDto>(
      `/api/v1/leads/${encodeURIComponent(params.leadId)}/message`,
      { method: "POST", body, headers: { "x-tenant-id": session.tenantId } },
    );
    return NextResponse.json(message);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
