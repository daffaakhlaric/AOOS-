import type { SupabaseClientLike } from "@aos/lead-store";

const CAMPAIGNS_TABLE = "meta_campaigns";

export class GrowthObjectiveCampaignsRepositoryError extends Error {}

interface CampaignListingRow {
  readonly meta_campaign_id: string;
  readonly listing_id: string | null;
}

/**
 * EYVRA — SAMANTHA V2 Phase 7. The REVERSE direction of `MetaSyncRepository.getCampaignListingId`
 * (which resolves one campaign -> its linked `listing_id`): given a Growth Objective's real
 * `focus_listing_ids`, finds every real synced `meta_campaigns` row already linked
 * (`053_meta_campaigns_listing_id.sql`'s `listing_id` column) to ANY of them, so
 * `GrowthObjectivesService.pacing` can sum real spend precisely for those campaigns rather than
 * falling back to noisy account-wide spend.
 *
 * No `.in()` on the shared `SupabaseClientLike` port (`@aos/lead-store`'s `SupabaseTypes.ts`
 * declares only `select`/`eq`/`gte`/`lte`/`order`/`limit`/`single`/`maybeSingle`) — same real gap
 * `MetaSyncRepository.reselectIds`/`CreativeMemoryRepository` already document on themselves. Same
 * established fix: select the whole tenant's `meta_campaigns` rows (bounded by one tenant's real
 * campaign count, never unbounded) and filter in-memory to the wanted `listingIds`.
 */
export class GrowthObjectiveCampaignsRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  /**
   * Real `meta_campaign_id`s whose `listing_id` is one of `listingIds`, scoped to `tenantId`.
   * Honest empty-array result — WITHOUT issuing any query — when `listingIds` is empty (an empty
   * `IN ()` is a real degenerate case worth guarding explicitly, not a wasted round-trip), and also
   * when none of the tenant's synced campaigns match any of those listings yet.
   */
  async findCampaignIdsForListings(
    tenantId: string,
    listingIds: readonly string[],
  ): Promise<readonly string[]> {
    if (listingIds.length === 0) {
      return [];
    }

    const wanted = new Set(listingIds);
    const { data, error } = await this.client
      .from<CampaignListingRow>(CAMPAIGNS_TABLE)
      .select("meta_campaign_id, listing_id")
      .eq("tenant_id", tenantId);
    if (error !== null) {
      throw new GrowthObjectiveCampaignsRepositoryError(
        `GrowthObjectiveCampaignsRepository.findCampaignIdsForListings failed: ${error.message}`,
      );
    }

    return (data ?? [])
      .filter((row) => row.listing_id !== null && wanted.has(row.listing_id))
      .map((row) => row.meta_campaign_id);
  }
}
