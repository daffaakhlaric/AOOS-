import type { AdAccountId, AdAccountRegistry } from "@aos/meta-ads-connector";

import type { ISpendProvider } from "../../contracts/ISpendProvider.js";

/**
 * Real implementation of `ISpendProvider` (design resolution #3), adapting
 * `@aos/meta-ads-connector`'s `AdAccountRegistry` — an in-memory cache of each ad account's most
 * recent sync snapshot, keyed by `AdAccountId`, holding `Campaign.spend` per campaign. Matches
 * spend by BOTH `Campaign.stableId` (the "#C047"-style id used throughout AAOS/DSS Motor
 * reporting, per the spec's pinned `rphSpkByCampaign` example) AND `Campaign.metaId` (the raw
 * Meta numeric id), so `GetClosingStats` resolves correctly regardless of which convention
 * `closings.campaign_id` was populated with.
 */
export class MetaAdsSpendAdapter implements ISpendProvider {
  constructor(
    private readonly registry: AdAccountRegistry,
    private readonly adAccountIds: readonly AdAccountId[],
  ) {}

  async getSpendByCampaign(campaignIds: readonly string[]): Promise<ReadonlyMap<string, number>> {
    const spendById = new Map<string, number>();
    for (const adAccountId of this.adAccountIds) {
      const found = this.registry.findById(adAccountId);
      if (!found.some) {
        continue;
      }
      for (const campaign of found.value.campaigns) {
        const amount = campaign.spend.toNumber();
        spendById.set(campaign.stableId.toString(), amount);
        spendById.set(campaign.metaId, amount);
      }
    }
    const result = new Map<string, number>();
    for (const id of campaignIds) {
      result.set(id, spendById.get(id) ?? 0);
    }
    return Promise.resolve(result);
  }
}
