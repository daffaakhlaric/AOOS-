import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { DecidePendingActionInput, PendingActionDto } from "@/types/pending-actions.types";

export const dynamic = "force-dynamic";

/**
 * `POST /api/pending-actions/:id/reject` — proxies `POST /api/v1/pending-actions/:id/reject`
 * (AAOS-OPERATING-MODE-APPROVAL-GATE's real Reject action — touches only `pending_agent_actions`,
 * never creates a campaign). Forwards the caller's real session email as `decidedBy` when present,
 * same discipline the approve route establishes.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as Partial<DecidePendingActionInput>;
  try {
    const data = await callAaosApi<PendingActionDto>(
      `/api/v1/pending-actions/${encodeURIComponent(params.id)}/reject`,
      {
        method: "POST",
        body: {
          ...(session.email !== undefined ? { decidedBy: session.email } : {}),
          ...(typeof body.decisionNotes === "string" && body.decisionNotes.length > 0
            ? { decisionNotes: body.decisionNotes }
            : {}),
        },
        headers: { "x-tenant-id": session.tenantId },
      },
    );
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
