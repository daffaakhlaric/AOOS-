import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { SettingsDto, UpdateOperatingModeInput } from "@/types/tenant.types";

/**
 * `PATCH /api/settings/operating-mode` — proxies `PATCH /api/v1/settings/operating-mode` (the new
 * "Mode Operasi AI" card's confirm-dialog action, AAOS-OPERATING-MODE-APPROVAL-GATE). Forwards the
 * caller's real session email as `changedBy` when present — same "never fabricate an actor"
 * discipline `app/api/settings/mode/route.ts`'s own doc establishes for `changedBy`: a caller with
 * no resolvable email just leaves the audit row's `operating_mode_changed_by` as `null` rather than
 * inventing a value.
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as Partial<UpdateOperatingModeInput>;
  if (body.operatingMode !== "FULL_CONTROL" && body.operatingMode !== "APPROVAL") {
    return NextResponse.json(
      { error: { message: "operatingMode must be 'FULL_CONTROL' or 'APPROVAL'" } },
      { status: 422 },
    );
  }
  try {
    const data = await callAaosApi<SettingsDto>("/api/v1/settings/operating-mode", {
      method: "PATCH",
      body: {
        operatingMode: body.operatingMode,
        ...(session.email !== undefined ? { changedBy: session.email } : {}),
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
