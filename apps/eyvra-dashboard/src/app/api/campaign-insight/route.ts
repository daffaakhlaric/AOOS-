import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { CampaignInsightResponseDto } from "@/types/dashboard.types";

// See `app/api/settings/route.ts`'s comment on this same export — this handler also reads the
// caller's real session cookies (via `resolveRouteSession`) on every request.
export const dynamic = "force-dynamic";

/**
 * `POST /api/campaign-insight` — AAOS-CAMPAIGNS-UNIFIED-PAGE. Thin proxy to `aaos-api`'s real
 * `POST /api/v1/campaigns/insight` (`MetaAdsController.getCampaignInsight` →
 * `LlmService.campaignInsight`), same `x-tenant-id: session.tenantId` forwarding convention every
 * other proxy route in this app already establishes (`app/api/verdicts/route.ts`,
 * `app/api/overview/route.ts`). The request body is the ONE selected campaign's already-aggregated
 * real metrics (`CampaignInsightRequestDto`) — `CampaignInsightPanel.tsx` composes it client-side
 * from the same `AdAccountSummaryDto` snapshot the rest of `/campaigns` already reads; this route
 * makes no Meta call of its own.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  const body: unknown = await request.json().catch(() => undefined);
  try {
    const data = await callAaosApi<CampaignInsightResponseDto>("/api/v1/campaigns/insight", {
      method: "POST",
      body,
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
