import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { AccountSummaryResponseDto } from "@/types/dashboard.types";

export const dynamic = "force-dynamic";

/**
 * `GET /api/campaign-health/account-summary` — thin proxy to aaos-api's real, real-data-wiring-fix
 * endpoint `GET /api/v1/command-center/account-summary` (`CommandCenterService.getAccountSummary`).
 * Same `resolveRouteSession -> 401 -> callAaosApi(x-tenant-id) -> JSON passthrough` convention every
 * other proxy route in this app follows.
 *
 * REPLACES the old per-campaign `GET /api/campaign-health/:campaignId` proxy (deleted — its only
 * caller, `useDecisionQueue.ts`'s legacy-verdict-prioritized top-5 fetch, is gone) with ONE real
 * server-side call that already covers EVERY real active campaign account-wide, so Needs Attention /
 * Opportunities / Samantha Decision Queue can all be computed from a single real fetch instead of
 * each independently re-deriving (or fetching) the same data.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  try {
    const data = await callAaosApi<AccountSummaryResponseDto>(
      "/api/v1/command-center/account-summary",
      { headers: { "x-tenant-id": session.tenantId } },
    );
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
