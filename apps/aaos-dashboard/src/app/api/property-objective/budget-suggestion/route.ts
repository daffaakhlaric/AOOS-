import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { BudgetSuggestionDto } from "@/types/property-objective.types";

export const dynamic = "force-dynamic";

/**
 * `GET /api/property-objective/budget-suggestion` — proxies
 * `GET /api/v1/property-objective/budget-suggestion?targetHotLeads=N`.
 *
 * NOTE (per `property-objective.controller.ts`'s own docstring on this exact endpoint, and Phase
 * O1's honest documentation of the gap): `aaos-api`'s `budget-suggestion` handler is NOT actually
 * tenant-scoped yet — it computes off `MetaAdsService.pullCampaigns`, which itself has no
 * `tenantId` parameter today (a real, separate, flagged follow-up; `MetaAdsService` would need
 * fixing first). This proxy route still resolves the real session and forwards `x-tenant-id`
 * anyway, for consistency with every other proxy route in this app and forward-compatibility once
 * that backend gap is closed — it is simply not consumed by this one backend endpoint yet. Not a
 * workaround, just staying consistent.
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
