import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { TriggerCheckResultDto } from "@/types/learning.types";

export const dynamic = "force-dynamic";

/**
 * `POST /api/learning/trigger` — proxies `POST /api/v1/learning/trigger` (AAOS Self-Improving,
 * Phase SI-6 — the Learning Monitor's real "Improve sekarang" manual-trigger button). The caller's
 * real session tenant is forwarded via `x-tenant-id` — never a client-supplied tenant id, same
 * convention every other real proxy route in this module already establishes.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { agent?: unknown };
  if (body.agent !== "SAMANTHA" && body.agent !== "CLARA") {
    return NextResponse.json(
      { error: { message: "agent must be SAMANTHA or CLARA" } },
      { status: 400 },
    );
  }
  try {
    const data = await callAaosApi<TriggerCheckResultDto>("/api/v1/learning/trigger", {
      method: "POST",
      body: { agent: body.agent },
      headers: { "x-tenant-id": session.tenantId },
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
