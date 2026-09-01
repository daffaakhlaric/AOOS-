import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { MessageDto } from "@/types/dashboard.types";

export const dynamic = "force-dynamic";

interface InterveneBody {
  readonly message: string;
  readonly managerName?: string;
}

/**
 * `POST /api/leads/:leadId/intervene` — proxies `aaos-api`'s `POST /api/v1/leads/:id/intervene`
 * (manager-as-Clara). Persisted server-side with `sender_type = 'MANAGER_INTERVENTION'`, never
 * `'CLARA'` — see `aaos-api`'s `intervene.dto.ts` docstring for the coordinator note this
 * corrects.
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
  const body = (await request.json()) as InterveneBody;
  try {
    const message = await callAaosApi<MessageDto>(
      `/api/v1/leads/${encodeURIComponent(params.leadId)}/intervene`,
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
