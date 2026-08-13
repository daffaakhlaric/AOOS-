import type { BranchId } from "@aos/branch-manager";

/** A campaign known to have been active for a branch on a given day, with its (period-to-date) spend. */
export interface ActiveCampaignSnapshot {
  readonly campaignId: string;
  readonly stableId: string;
  readonly campaignName: string;
  readonly branch: BranchId;
  readonly spend: number;
}

/**
 * Judgment call (mirrors `@aos/lead-store`'s `ISpendProvider` design resolution #3): "Method 2 —
 * Time-based" and "Method 3 — Branch-based" attribution both need "which campaigns were active for
 * branch X on day Y, and what did they spend" — data that lives in `@aos/meta-ads-connector`'s
 * `AdAccountRegistry`/`Campaign` entities, not in this package or in `@aos/lead-store`. Rather than
 * take a structural dependency on that registry's shape directly inside the attribution engine,
 * this package defines its own minimal port (Dependency Inversion) that a production adapter can
 * implement against the real `@aos/meta-ads-connector` `AdAccountRegistry`. Tests inject a
 * hand-rolled mock matching this exact interface. See package report "ICampaignActivityProvider".
 */
export interface ICampaignActivityProvider {
  /** Returns every campaign active for `branch` on `date` (calendar day, any active hour), with the campaign's spend known so far. Empty array when none found — never throws for "not found". Powers Method 2 — Time-based attribution. */
  getActiveCampaignsForBranch(
    branch: BranchId,
    date: Date,
  ): Promise<ReadonlyArray<ActiveCampaignSnapshot>>;

  /** Returns every campaign active for `branch` anywhere within `[fromDate, toDate]` — a broader net than the single-day lookup above, used only when that returns empty. Powers Method 3 — Branch-based (proportional) attribution. */
  getActiveCampaignsForBranchInPeriod(
    branch: BranchId,
    fromDate: Date,
    toDate: Date,
  ): Promise<ReadonlyArray<ActiveCampaignSnapshot>>;
}
