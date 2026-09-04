import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { LearningProposalDto } from "@/types/learning.types";

// See `app/api/settings/route.ts`'s comment on this same export — this GET handler also reads
// the caller's real session cookies on every request.
export const dynamic = "force-dynamic";

/** `GET /api/learning/proposals` — proxies `GET /api/v1/learning/proposals` (Learning Monitor's real, tenant-scoped list of PENDING/decided proposals, optionally filtered by `?status=`). */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  const url = new URL(request.url);
  try {
    const data = await callAaosApi<readonly LearningProposalDto[]>("/api/v1/learning/proposals", {
      headers: { "x-tenant-id": session.tenantId },
      searchParams: { status: url.searchParams.get("status") ?? undefined },
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
