import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { RollbackResultDto } from "@/types/learning.types";

export const dynamic = "force-dynamic";

/**
 * `POST /api/learning/prompt-overrides/:agent/:promptKey/rollback` — proxies
 * `POST /api/v1/learning/prompt-overrides/:tenantId/:agent/:promptKey/rollback` for the caller's
 * own real session tenant (never a client-supplied tenant id). A real, manual, auditable action
 * (design doc Finding #6) — never an automatic score-triggered rollback.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { agent: string; promptKey: string } },
): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  try {
    const data = await callAaosApi<RollbackResultDto>(
      `/api/v1/learning/prompt-overrides/${encodeURIComponent(session.tenantId)}/${encodeURIComponent(params.agent)}/${encodeURIComponent(params.promptKey)}/rollback`,
      { method: "POST", headers: { "x-tenant-id": session.tenantId } },
    );
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
