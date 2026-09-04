import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { AgentConfigDto, SetAgentConfigInput } from "@/types/learning.types";

export const dynamic = "force-dynamic";

/** `GET /api/learning/configs` — proxies `GET /api/v1/learning/configs` (AAOS Self-Improving, Phase SI-6 — the Learning Monitor's real Config editor "view current values" read, the caller's own real session tenant). */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  try {
    const data = await callAaosApi<readonly AgentConfigDto[]>("/api/v1/learning/configs", {
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

/**
 * `PUT /api/learning/configs` — proxies `PUT /api/v1/learning/configs` (AAOS Self-Improving, Phase
 * SI-6 — the Learning Monitor's real Config editor WRITE). Forwards the caller's real session email
 * as `updatedBy` when present, same "never fabricate an actor" discipline
 * `app/api/learning/proposals/[id]/approve/route.ts`'s own doc establishes for `decidedBy`.
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as Partial<SetAgentConfigInput>;
  if (
    typeof body.agent !== "string" ||
    typeof body.configKey !== "string" ||
    typeof body.value !== "number" ||
    !Number.isFinite(body.value)
  ) {
    return NextResponse.json(
      { error: { message: "agent, configKey (string) and value (finite number) are required" } },
      { status: 400 },
    );
  }
  try {
    const data = await callAaosApi<AgentConfigDto>("/api/v1/learning/configs", {
      method: "PUT",
      body: {
        agent: body.agent,
        configKey: body.configKey,
        value: body.value,
        ...(session.email !== undefined ? { updatedBy: session.email } : {}),
      },
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
