import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { SettingsDto, UpdateModeInput } from "@/types/tenant.types";

/**
 * `PATCH /api/settings/mode` — proxies `PATCH /api/v1/settings/mode` (the new "Mode Operasi"
 * card's confirm-dialog action, AAOS-PROPERTY-DEVLIVE-ACTIVITYLOG Phase A point 4). Forwards the
 * caller's real session email as `changedBy` when present — same "never fabricate an actor"
 * discipline as the aaos-api DTO's own doc: a caller with no resolvable email just leaves the
 * audit row's `mode_changed_by` as `null` rather than inventing a value.
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as Partial<UpdateModeInput>;
  if (body.mode !== "DEV" && body.mode !== "LIVE") {
    return NextResponse.json(
      { error: { message: "mode must be 'DEV' or 'LIVE'" } },
      { status: 422 },
    );
  }
  try {
    const data = await callAaosApi<SettingsDto>("/api/v1/settings/mode", {
      method: "PATCH",
      body: {
        mode: body.mode,
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
