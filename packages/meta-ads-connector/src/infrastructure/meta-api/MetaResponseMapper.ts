import { err, ok, type Result } from "@aos/common";
import type { ValidationError } from "@aos/errors";

import type { Ad } from "../../domain/entities/Ad.js";
import type { AdSet } from "../../domain/entities/AdSet.js";
import type { Campaign } from "../../domain/entities/Campaign.js";
import type { AdAccountId } from "../../domain/value-objects/AdAccountId.js";
import type { AdSetId } from "../../domain/value-objects/AdSetId.js";
import type { Branch } from "../../domain/value-objects/Branch.js";
import type { CampaignId } from "../../domain/value-objects/CampaignId.js";
import type { Funnel } from "../../domain/value-objects/Funnel.js";
import { mapAd } from "../../mappers/AdMapper.js";
import { mapAdSet } from "../../mappers/AdSetMapper.js";
import { mapCampaign } from "../../mappers/CampaignMapper.js";
import type { MetaAd, MetaAdSet, MetaCampaign } from "../../types/MetaApiTypes.js";

/**
 * Thin top-level orchestrator wiring already-Zod-validated Meta list responses (from
 * `MetaApiClient`, typed via `types/MetaApiTypes.ts`) through the per-entity `mappers/*.ts`
 * functions. The split: `mappers/*.ts` map *one* raw item to *one* domain entity; this module
 * maps a whole page of raw items to a domain array, assigning each item's 1-based placeholder
 * `StableId` sequence (later overwritten by `utils/StableIdAssigner.ts` once the full spend-sorted
 * hierarchy is known — see `CampaignMapper`'s docstring).
 */
export class MetaResponseMapper {
  static mapCampaigns(
    raws: ReadonlyArray<MetaCampaign>,
    adAccountId: AdAccountId,
  ): Result<Campaign[], ValidationError> {
    const campaigns: Campaign[] = [];
    for (let i = 0; i < raws.length; i += 1) {
      const raw = raws[i];
      if (raw === undefined) {
        continue;
      }
      const result = mapCampaign(raw, adAccountId, i + 1);
      if (!result.ok) {
        return err(result.error);
      }
      campaigns.push(result.value);
    }
    return ok(campaigns);
  }

  static mapAdSets(
    raws: ReadonlyArray<MetaAdSet>,
    campaignId: CampaignId,
    adAccountId: AdAccountId,
  ): Result<AdSet[], ValidationError> {
    const adSets: AdSet[] = [];
    for (let i = 0; i < raws.length; i += 1) {
      const raw = raws[i];
      if (raw === undefined) {
        continue;
      }
      const result = mapAdSet(raw, campaignId, adAccountId, i + 1);
      if (!result.ok) {
        return err(result.error);
      }
      adSets.push(result.value);
    }
    return ok(adSets);
  }

  static mapAds(
    raws: ReadonlyArray<MetaAd>,
    campaignId: CampaignId,
    adSetId: AdSetId,
    adAccountId: AdAccountId,
    inheritedFunnel: Funnel,
    inheritedBranch: Branch,
    now: Date,
  ): Result<Ad[], ValidationError> {
    const ads: Ad[] = [];
    for (let i = 0; i < raws.length; i += 1) {
      const raw = raws[i];
      if (raw === undefined) {
        continue;
      }
      const result = mapAd(
        raw,
        campaignId,
        adSetId,
        adAccountId,
        inheritedFunnel,
        inheritedBranch,
        i + 1,
        now,
      );
      if (!result.ok) {
        return err(result.error);
      }
      ads.push(result.value);
    }
    return ok(ads);
  }
}
