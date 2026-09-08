import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type {
  PropertyObjectiveDto,
  UpdateAutoPublishSettingsInput,
} from "@/types/property-objective.types";

export const dynamic = "force-dynamic";

/**
 * `PATCH /api/property-objective/auto-publish-settings` — proxies
 * `PATCH /api/v1/property-objective/auto-publish-settings` (AAOS LOOP UPGRADE, Sprint 8c — the real
 * `auto_publish_campaign`/`max_budget_increase_pct` guardrail settings this dispatch's own
 * coordinator note requires a real Settings UI for). Mirrors
 * `business-context/route.ts`'s exact shape.
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as Partial<UpdateAutoPublishSettingsInput>;
  try {
    const data = await callAaosApi<PropertyObjectiveDto>(
      "/api/v1/property-objective/auto-publish-settings",
      {
        method: "PATCH",
        body: {
          ...(body.autoPublishCampaign !== undefined
            ? { autoPublishCampaign: body.autoPublishCampaign }
            : {}),
          ...(body.maxBudgetIncreasePct !== undefined
            ? { maxBudgetIncreasePct: body.maxBudgetIncreasePct }
            : {}),
        },
        headers: { "x-tenant-id": session.tenantId },
      },
    );
    return NextResponse.json({ objective: data });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
