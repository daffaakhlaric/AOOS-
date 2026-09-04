import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { DecideProposalInput, LearningProposalDto } from "@/types/learning.types";

export const dynamic = "force-dynamic";

/**
 * `POST /api/learning/proposals/:id/approve` — proxies `POST /api/v1/learning/proposals/:id/approve`
 * (AAOS Self-Learning AI, Phase C — the human-approval gate's real Approve action). Forwards the
 * caller's real session email as `decidedBy` when present — same "never fabricate an actor"
 * discipline `app/api/settings/mode/route.ts`'s own doc establishes for `changedBy`: a caller with
 * no resolvable email just leaves `learning_proposals.decided_by` `null` rather than inventing a
 * value. `decisionNotes` (optional) is forwarded verbatim from the request body.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as Partial<DecideProposalInput>;
  try {
    const data = await callAaosApi<LearningProposalDto>(
      `/api/v1/learning/proposals/${encodeURIComponent(params.id)}/approve`,
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
