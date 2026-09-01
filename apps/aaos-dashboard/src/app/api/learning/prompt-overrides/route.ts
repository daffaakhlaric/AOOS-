import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { PromptOverrideDto } from "@/types/learning.types";

export const dynamic = "force-dynamic";

/** `GET /api/learning/prompt-overrides` — proxies `GET /api/v1/learning/prompt-overrides/:tenantId/active` (the caller's own tenant, resolved from the real session — never a client-supplied tenant id). Learning Monitor's "what's live right now" table. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  try {
    const data = await callAaosApi<readonly PromptOverrideDto[]>(
      `/api/v1/learning/prompt-overrides/${encodeURIComponent(session.tenantId)}/active`,
      { headers: { "x-tenant-id": session.tenantId } },
    );
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
