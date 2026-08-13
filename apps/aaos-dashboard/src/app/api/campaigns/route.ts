import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { AdAccountSummaryDto, CampaignAdDto } from "@/types/dashboard.types";

interface AdAccountResponseDto {
  readonly id: string;
  readonly name: string;
  readonly syncedAt: string;
  readonly campaigns: ReadonlyArray<{
    readonly name: string;
    readonly adSets: ReadonlyArray<{
      readonly ads: ReadonlyArray<{
        readonly id: string;
        readonly name: string;
        readonly status: string;
        readonly funnel: string;
        readonly branch: string;
        readonly verdict: string;
        readonly metrics: CampaignAdDto["metrics"];
      }>;
    }>;
  }>;
}

const ZERO_METRICS: CampaignAdDto["metrics"] = {
  spend: 0,
  conversations: 0,
  d2: 0,
  d3: 0,
  d5: 0,
  leadForm: 0,
  totalLead: 0,
  rphD3: null,
};

function flatten(adAccount: AdAccountResponseDto): AdAccountSummaryDto {
  const ads: CampaignAdDto[] = [];
  for (const campaign of adAccount.campaigns) {
    for (const adSet of campaign.adSets) {
      for (const ad of adSet.ads) {
        ads.push({
          id: ad.id,
          name: ad.name,
          campaignName: campaign.name,
          status: ad.status,
          funnel: ad.funnel,
          branch: ad.branch,
          verdict: ad.verdict,
          metrics: ad.metrics,
        });
      }
    }
  }
  const totals = ads.reduce(
    (acc, ad) => ({
      spend: acc.spend + ad.metrics.spend,
      conversations: acc.conversations + ad.metrics.conversations,
      d2: acc.d2 + ad.metrics.d2,
      d3: acc.d3 + ad.metrics.d3,
      d5: acc.d5 + ad.metrics.d5,
      leadForm: acc.leadForm + ad.metrics.leadForm,
      totalLead: acc.totalLead + ad.metrics.totalLead,
      rphD3: null,
    }),
    { ...ZERO_METRICS },
  );
  return { id: adAccount.id, name: adAccount.name, syncedAt: adAccount.syncedAt, ads, totals };
}

/** `GET /api/campaigns` — proxies `GET /api/v1/campaigns` on `aaos-api` (spec "API Integration"), flattening the campaign/ad-set/ad hierarchy into a single ad-level list this app's `CampaignTable` renders directly. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const adAccountId = request.nextUrl.searchParams.get("adAccountId") ?? undefined;
  const datePreset = request.nextUrl.searchParams.get("datePreset") ?? undefined;
  try {
    const data = await callAaosApi<AdAccountResponseDto>("/api/v1/campaigns", {
      searchParams: { adAccountId, datePreset },
    });
    return NextResponse.json(flatten(data));
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
