import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";

export const dynamic = "force-dynamic";

interface CampaignListingIdResponseDto {
  readonly campaignId: string;
  readonly listingId: string | null;
}

/**
 * `GET /api/campaigns/:campaignId/listing-id` — Campaign->Listing Mapping. Proxies `aaos-api`'s
 * real `GET /api/v1/campaigns/:campaignId/listing-id` (`meta_campaigns.listing_id`, see
 * `053_meta_campaigns_listing_id.sql`). Same shape `.../history` and `.../andromeda-health`'s own
 * proxy routes already establish. `listingId: null` (never fabricated) is a real, honest, common
 * result — most campaigns have no real link yet.
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
