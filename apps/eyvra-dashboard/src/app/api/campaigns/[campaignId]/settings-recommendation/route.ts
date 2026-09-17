import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { MetaSettingsRecommendationResponseDto } from "@/types/dashboard.types";

// See `app/api/settings/route.ts`'s comment on this same export — this handler also reads the
// caller's real session cookies (via `resolveRouteSession`) on every request.
export const dynamic = "force-dynamic";

/**
 * `POST /api/campaigns/:campaignId/settings-recommendation` — SAMANTHA META ADS SETTINGS +
 * CREATIVE COPY. Thin proxy to `aaos-api`'s real `POST /api/v1/campaigns/settings-recommendation`
 * (`MetaAdsController.getMetaSettingsRecommendation` → `LlmService.metaSettingsRecommendation`),
 * same shape `app/api/campaign-insight/route.ts` already establishes. `:campaignId` in the URL is
 * purely for REST-shape consistency with the sibling `.../history` route — never read here — the
 * real request body (`MetaSettingsRecommendationRequestDto`) already carries its own `campaignId`.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  const body: unknown = await request.json().catch(() => undefined);
  try {
    const data = await callAaosApi<MetaSettingsRecommendationResponseDto>(
      "/api/v1/campaigns/settings-recommendation",
      {
        method: "POST",
        body,
        headers: { "x-tenant-id": session.tenantId },
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
