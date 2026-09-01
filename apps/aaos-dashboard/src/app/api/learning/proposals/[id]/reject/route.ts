import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { DecideProposalInput, LearningProposalDto } from "@/types/learning.types";

export const dynamic = "force-dynamic";

/** `POST /api/learning/proposals/:id/reject` — proxies `POST /api/v1/learning/proposals/:id/reject`. Same `decidedBy`/`decisionNotes` forwarding as `.../approve/route.ts`. Touches nothing in `agent_prompt_overrides` — see `LearningDecisionService.reject`'s own doc. */
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
      `/api/v1/learning/proposals/${encodeURIComponent(params.id)}/reject`,
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
