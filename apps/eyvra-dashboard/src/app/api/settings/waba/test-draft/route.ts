import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { TestConnectionResultDto } from "@/types/tenant.types";

/**
 * `POST /api/settings/waba/test-draft` — proxies `POST /api/v1/settings/waba/test-draft`.
 * Tests a raw, UNSAVED `phoneNumberId`/`accessToken` pair from `WabaConfigModal`'s Add/Edit form
 * — distinct from `waba/[id]/test/route.ts`, which tests an already-saved row.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  const body: unknown = await request.json().catch(() => ({}));
  try {
    const data = await callAaosApi<TestConnectionResultDto>("/api/v1/settings/waba/test-draft", {
      method: "POST",
      body: body as { phoneNumberId: string; accessToken: string },
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
