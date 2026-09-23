import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { CampaignListingIdResponseDto } from "@/types/dashboard.types";

export const dynamic = "force-dynamic";

/**
 * `GET /api/campaigns/:campaignId/listing-id` — thin proxy to aaos-api's real, already-live
 * `GET /api/v1/campaigns/:campaignId/listing-id` (`MetaAdsController.getCampaignListingId`).
 * First link of the real Campaign->Listing->photo chain the Samantha Attention Queue's row
 * thumbnails use; returns `{ campaignId, listingId: string | null }` verbatim, so a genuinely
 * unlinked campaign stays honestly `null` rather than becoming a stock image.
 *
 * Same `resolveRouteSession -> 401 -> callAaosApi(x-tenant-id) -> JSON passthrough` convention every
 * other proxy route in this app follows.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { campaignId: string } },
): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  try {
    const data = await callAaosApi<CampaignListingIdResponseDto>(
      `/api/v1/campaigns/${encodeURIComponent(params.campaignId)}/listing-id`,
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
