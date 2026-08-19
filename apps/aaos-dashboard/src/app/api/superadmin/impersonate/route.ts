import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { ImpersonateResponseDto } from "@/types/tenant.types";

/**
 * `POST /api/superadmin/impersonate` — "Login as Tenant" (Part 1). Verifies the caller's REAL
 * `role === 'superadmin'` session here (not just via `middleware.ts`'s gate — this endpoint mints
 * a real sign-in link for another account, the single most sensitive action in this whole
 * feature, so it re-checks), then forwards the superadmin's own `actorEmail`/`actorId` to
 * `apps/aaos-api` for its audit log line — never trusts a client-supplied actor identity.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null || session.role !== "superadmin") {
    return NextResponse.json({ error: { message: "Forbidden" } }, { status: 403 });
  }
  if (session.email === undefined) {
    return NextResponse.json(
      { error: { message: "Superadmin session has no email on file" } },
      { status: 500 },
    );
  }
  const body: unknown = await request.json().catch(() => ({}));
  const tenantId =
    typeof body === "object" && body !== null && "tenantId" in body
      ? String((body as { tenantId: unknown }).tenantId)
      : undefined;
  if (tenantId === undefined || tenantId.length === 0) {
    return NextResponse.json({ error: { message: "tenantId is required" } }, { status: 400 });
  }

  try {
    const data = await callAaosApi<ImpersonateResponseDto>("/api/v1/superadmin/impersonate", {
      method: "POST",
      body: { tenantId, actorEmail: session.email, actorId: session.userId },
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
