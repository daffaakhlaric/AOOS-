import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type {
  AdAccountSummaryDto,
  AdSetSummaryDto,
  AdSummaryDto,
  CampaignAdDto,
  CampaignSummaryDto,
} from "@/types/dashboard.types";

// See `app/api/settings/route.ts`'s comment on this same export — this handler also reads the
// caller's real session cookies (via `resolveRouteSession`) on every request.
export const dynamic = "force-dynamic";

/** `aaos-api`'s real `GET /api/v1/campaigns` response shape (`apps/aaos-api/src/modules/meta-ads/dto/campaign-response.dto.ts`) — already carries the full hierarchy with real, spend-sorted `stableId`s (`@aos/meta-ads-connector`'s `StableIdAssigner`) and per-ad `verdict` (the real `VerdictEngine`). Nothing here is recomputed — this route only reshapes field names for the browser. */
interface AdAccountResponseDto {
  readonly id: string;
  readonly name: string;
  readonly syncedAt: string;
  readonly campaigns: ReadonlyArray<{
    readonly id: string;
    readonly stableId: string;
    readonly name: string;
    readonly objective: string;
    readonly status: string;
    readonly spend: number;
    readonly adSets: ReadonlyArray<{
      readonly id: string;
      readonly stableId: string;
      readonly name: string;
      readonly status: string;
      readonly spend: number;
      readonly ads: ReadonlyArray<{
        readonly id: string;
        readonly stableId: string;
        readonly name: string;
        readonly status: string;
        readonly funnel: string;
        readonly branch: string;
        readonly verdict: string;
        readonly metrics: CampaignAdDto["metrics"];
        readonly daysSinceCreation?: number;
      }>;
    }>;
  }>;
}

const ZERO_METRICS: CampaignAdDto["metrics"] = {
  spend: 0,
  clicks: 0,
  frequency: 0,
  conversations: 0,
  d2: 0,
  d3: 0,
  d5: 0,
  leadForm: 0,
  totalLead: 0,
  rphD3: null,
  rphLead: null,
  impressions: 0,
};

function toAdSummary(
  ad: AdAccountResponseDto["campaigns"][number]["adSets"][number]["ads"][number],
): AdSummaryDto {
  return {
    id: ad.id,
    stableId: ad.stableId,
    name: ad.name,
    status: ad.status,
    funnel: ad.funnel,
    branch: ad.branch,
    verdict: ad.verdict,
    metrics: ad.metrics,
    ...(ad.daysSinceCreation !== undefined ? { daysSinceCreation: ad.daysSinceCreation } : {}),
  };
}

function toAdSetSummary(
  adSet: AdAccountResponseDto["campaigns"][number]["adSets"][number],
): AdSetSummaryDto {
  return {
    id: adSet.id,
    stableId: adSet.stableId,
    name: adSet.name,
    status: adSet.status,
    spend: adSet.spend,
    ads: adSet.ads.map(toAdSummary),
  };
}

function toCampaignSummary(
  campaign: AdAccountResponseDto["campaigns"][number],
): CampaignSummaryDto {
  return {
    id: campaign.id,
    stableId: campaign.stableId,
    name: campaign.name,
    objective: campaign.objective,
    status: campaign.status,
    spend: campaign.spend,
    adSets: campaign.adSets.map(toAdSetSummary),
  };
}

/**
 * Real bug fix (MAAO2 redesign): this route used to flatten the campaign→ad-set→ad hierarchy into
 * a single ads[] list, discarding `aaos-api`'s real spend-sorted `#A/#B/#C` stableIds and the
 * ad-set-level spend rollups the MAAO2-style tree view needs. It now keeps the full `campaigns[]`
 * hierarchy AND still returns the flattened `ads[]` list, since `CampaignDetailClient`
 * (`/meta-ads/[campaignId]`) looks a single ad up by id from that flat list and has no use for the
 * tree shape.
 */
function toSummary(adAccount: AdAccountResponseDto): AdAccountSummaryDto {
  const campaigns = adAccount.campaigns.map(toCampaignSummary);

  const ads: CampaignAdDto[] = [];
  for (const campaign of adAccount.campaigns) {
    for (const adSet of campaign.adSets) {
      for (const ad of adSet.ads) {
        ads.push({
          id: ad.id,
          stableId: ad.stableId,
          name: ad.name,
          campaignName: campaign.name,
          status: ad.status,
          funnel: ad.funnel,
          branch: ad.branch,
          verdict: ad.verdict,
          metrics: ad.metrics,
          ...(ad.daysSinceCreation !== undefined
            ? { daysSinceCreation: ad.daysSinceCreation }
            : {}),
        });
      }
    }
  }

  const totals = ads.reduce(
    (acc, ad) => ({
      spend: acc.spend + ad.metrics.spend,
      clicks: acc.clicks + ad.metrics.clicks,
      // Not summed — `frequency` is a per-ad average (impressions/reach), not an additive count;
      // same judgment call already made for `rphD3` below. Nothing in this spec reads
      // `totals.frequency` (the "audiens jenuh" check is per-ad only), so it stays at 0.
      frequency: 0,
      conversations: acc.conversations + ad.metrics.conversations,
      d2: acc.d2 + ad.metrics.d2,
      d3: acc.d3 + ad.metrics.d3,
      d5: acc.d5 + ad.metrics.d5,
      leadForm: acc.leadForm + ad.metrics.leadForm,
      totalLead: acc.totalLead + ad.metrics.totalLead,
      // Additive, real (Sprint 5 Prompt 13) — same convention as `spend`/`clicks` above, now that
      // `impressions` is genuinely plumbed through from `aaos-api`'s real per-ad value (see
      // `AdMetricsDto.impressions`'s own docstring in `dashboard.types.ts`).
      impressions: (acc.impressions ?? 0) + (ad.metrics.impressions ?? 0),
      rphD3: null,
      // Not summed — same non-additive-average judgment call as `rphD3` above (a group's real
      // Rp/Lead is `groupSpend / groupTotalLead`, not a sum of per-ad ratios). Callers needing a
      // group-level Rp/Lead (e.g. the KPI strip, "Per Cabang") derive it themselves from spend/lead.
      rphLead: null,
    }),
    { ...ZERO_METRICS },
  );

  return {
    id: adAccount.id,
    name: adAccount.name,
    syncedAt: adAccount.syncedAt,
    campaigns,
    ads,
    totals,
    campaignCount: campaigns.length,
    adCount: ads.length,
  };
}

// Meta rate-limit UX mitigation (docs/PROMPT-AAOS-GEO-TARGETING-AND-REGION-PICKER.md Part C):
// bumped from 5 to 15 minutes. Real, honest cause of increased Meta rate-limit hits: the Meta Ads
// Tenant-Scoping Fix (`c8d739c`) gave each tenant its own real per-tenant `cacheKey` — correct, but
// it also means tenants no longer accidentally share one cache entry, which had incidentally kept
// real Meta call volume down. This is a real, scoped lever on that increased volume (not a fix for
// a new bug) — see this file's own `cache` docstring below for the two-layer cache this sits under.
const CACHE_TTL_MS = 900_000; // 15 minutes

interface CacheEntry {
  readonly body: AdAccountSummaryDto;
  readonly cachedAt: number;
}

/**
 * Real bug fix: this route was calling `aaos-api` → Meta's Insights API on every single mount of
 * `MetaAdsClient` with no caching at all, which was tripping Meta's own rate limit under normal
 * use (page revisits, tab refocus, etc., each firing a fresh Meta API round-trip). A simple
 * in-memory, per-process, per-query-key cache with a 5-minute TTL absorbs repeat requests for the
 * same `adAccountId`/`datePreset` combination without a second Meta API call. This is a *second*,
 * server-side layer on top of `MetaAdsClient`'s own 60-minute `localStorage` cache — this one
 * protects against multiple browser tabs/sessions each independently deciding their local cache is
 * stale at roughly the same time.
 *
 * Deliberately NOT a shared/distributed cache (Redis, etc.) — this is a single Next.js server
 * process for one dealership's internal dashboard, not a multi-instance deployment; a `Map` living
 * in the route module's closure is correct for this scale and needs no extra infrastructure. It is
 * cleared on every server restart/redeploy, which is fine — a cold cache just means the next
 * request pays for one real fetch.
 *
 * TENANT-SCOPING FIX (Phase T2, docs/PROMPT-AAOS-META-ADS-TENANT-SCOPING.md): `cacheKey` now
 * includes the real per-request `tenantId` — this cache is process-wide (shared across every
 * tenant's requests in this one Next.js server), so without a tenant-scoped key, one tenant's
 * first fetch would serve a second tenant's `adAccountId`/`datePreset`-matching request its
 * cached campaign data for up to 5 minutes — the exact same class of bug this whole phase fixes,
 * just newly introduced here instead of inherited.
 */
const cache = new Map<string, CacheEntry>();

function cacheKey(
  tenantId: string,
  adAccountId: string | undefined,
  datePreset: string | undefined,
): string {
  return `${tenantId}::${adAccountId ?? ""}::${datePreset ?? ""}`;
}

/**
 * `GET /api/campaigns` — proxies `GET /api/v1/campaigns` on `aaos-api` (spec "API Integration"),
 * reshaping it into `AdAccountSummaryDto` (hierarchy + flattened list + totals/counts) for this
 * app's client components. Cached 5 minutes per `adAccountId`/`datePreset` — see `cache` above.
 * `?refresh=1` bypasses the cache *read* (a fresh result is still written back into it) — used by
 * `MetaAdsClient`'s manual "Tarik Data" button and its post-Execute re-fetch, both of which need
 * genuinely fresh data rather than up-to-5-minutes-stale.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  const adAccountId = request.nextUrl.searchParams.get("adAccountId") ?? undefined;
  const datePreset = request.nextUrl.searchParams.get("datePreset") ?? undefined;
  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";
  const key = cacheKey(session.tenantId, adAccountId, datePreset);

  const cached = cache.get(key);
  if (!forceRefresh && cached !== undefined && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return NextResponse.json(cached.body);
  }

  try {
    const data = await callAaosApi<AdAccountResponseDto>("/api/v1/campaigns", {
      searchParams: { adAccountId, datePreset },
      headers: { "x-tenant-id": session.tenantId },
    });
    const summary = toSummary(data);
    cache.set(key, { body: summary, cachedAt: Date.now() });
    return NextResponse.json(summary);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
