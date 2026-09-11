import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { DiagnoseAdCopyResponseDto } from "@/types/dashboard.types";

// See `app/api/settings/route.ts`'s comment on this same export — this handler also reads the
// caller's real session cookies (via `resolveRouteSession`) on every request.
export const dynamic = "force-dynamic";

/**
 * `POST /api/ads/diagnose-copy` — Samantha Advanced Sprint 1. Thin proxy to `aaos-api`'s real
 * `POST /api/v1/ads/diagnose-copy` (`MetaAdsController.getAdCopyDiagnosis` →
 * `LlmService.diagnoseAdCopy`, AAOS Samantha Professional Optimizer Part C), same
 * `x-tenant-id: session.tenantId` forwarding convention every other proxy route in this app already
 * establishes (`app/api/campaign-insight/route.ts`, `app/api/verdicts/route.ts`). The request body
 * is ONE already-loaded ad's real `primaryText`/`headline`/`description`/`verdict`/metrics/
 * `learningStatus` (`DiagnoseAdCopyRequestDto`) — the new `CampaignAdDrillDown` component composes
 * it client-side from the same `AdSummaryDto` the campaign tree already has loaded; this route
 * makes no Meta call of its own.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  const body: unknown = await request.json().catch(() => undefined);
  try {
    const data = await callAaosApi<DiagnoseAdCopyResponseDto>("/api/v1/ads/diagnose-copy", {
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
