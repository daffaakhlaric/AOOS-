import { none, some, type Option } from "@aos/common";

import type { IAdAccountRepository } from "../contracts/IAdAccountRepository.js";
import type { AdAccount } from "../domain/entities/AdAccount.js";
import type { AdAccountId } from "../domain/value-objects/AdAccountId.js";
import type { AdIdentifiers } from "../mappers/LeadMapper.js";

type IndexedAd = AdIdentifiers;

/**
 * In-memory, per-process, id-keyed cache of the most recent `AdAccount` sync snapshot per
 * account — NOT a persistence layer (no DB/filesystem writes, per the package's hard
 * constraints). Satisfies `IAdAccountRepository`. Also indexes every Ad within every stored
 * snapshot by its raw Meta `metaId`, so `ProcessLeadWebhook` can resolve a webhook's `ad_id` to
 * internal AAOS ids via `resolveAd` (the `AdResolver` `LeadMapper` expects) without a second data
 * store.
 */
export class AdAccountRegistry implements IAdAccountRepository {
  private readonly accountsById = new Map<string, AdAccount>();
  private readonly adsByMetaId = new Map<string, IndexedAd>();

  findById(id: AdAccountId): Option<AdAccount> {
    const found = this.accountsById.get(id.toString());
    return found === undefined ? none : some(found);
  }

  save(adAccount: AdAccount): void {
    this.accountsById.set(adAccount.id.toString(), adAccount);
    for (const campaign of adAccount.campaigns) {
      for (const adSet of campaign.adSets) {
        for (const ad of adSet.ads) {
          this.adsByMetaId.set(ad.metaId, {
            adId: ad.id,
            adSetId: adSet.id,
            campaignId: campaign.id,
            adAccountId: adAccount.id,
          });
        }
      }
    }
  }

  /** Resolves a raw Meta ad id to internal identifiers, for `LeadMapper`'s `AdResolver`. */
  resolveAdByMetaId(metaAdId: string): Option<IndexedAd> {
    const found = this.adsByMetaId.get(metaAdId);
    return found === undefined ? none : some(found);
  }

  /** Removes every stored snapshot and ad index entry — primarily for test isolation between sync runs. */
  clear(): void {
    this.accountsById.clear();
    this.adsByMetaId.clear();
  }
}
