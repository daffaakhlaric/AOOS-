import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { BudgetSuggestionDto } from "@/types/property-objective.types";

export const dynamic = "force-dynamic";

/**
 * `GET /api/property-objective/budget-suggestion` — proxies
 * `GET /api/v1/property-objective/budget-suggestion?targetHotLeads=N`.
 *
 * UPDATE (TENANT-SCOPING FIX, Phase T2, docs/PROMPT-AAOS-META-ADS-TENANT-SCOPING.md): the gap this
 * doc used to describe is now closed — `MetaAdsService.pullCampaigns` takes a real `tenantId`
 * parameter, and `PropertyObjectiveController.getBudgetSuggestion` reads a real `@TenantId()` and
 * threads it through. This route already forwarded `x-tenant-id` ahead of that fix (for
 * forward-compatibility, per this doc's own earlier note) — no change was needed here, it is now
 * genuinely consumed end-to-end rather than merely forwarded-but-unused.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  const url = new URL(request.url);
  try {
    const data = await callAaosApi<BudgetSuggestionDto>(
      "/api/v1/property-objective/budget-suggestion",
      {
        headers: { "x-tenant-id": session.tenantId },
        searchParams: {
          targetHotLeads: url.searchParams.get("targetHotLeads") ?? undefined,
        },
      },
    );
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
