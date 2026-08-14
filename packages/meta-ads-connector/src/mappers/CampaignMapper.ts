import { err, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

import { Campaign } from "../domain/entities/Campaign.js";
import type { AdAccountId } from "../domain/value-objects/AdAccountId.js";
import { AdStatus } from "../domain/value-objects/AdStatus.js";
import { CampaignId } from "../domain/value-objects/CampaignId.js";
import { parseCampaignObjective } from "../domain/value-objects/CampaignObjective.js";
import { Spend } from "../domain/value-objects/Spend.js";
import { StableId } from "../domain/value-objects/StableId.js";
import type { MetaCampaign } from "../types/MetaApiTypes.js";
import { extractBranch } from "../utils/BranchExtractor.js";
import { classifyFunnel } from "../utils/FunnelClassifier.js";

const KNOWN_STATUSES: ReadonlySet<string> = new Set(Object.values(AdStatus));

/**
 * Maps a single (already Zod-validated) raw Meta campaign into the AAOS `Campaign` entity.
 *
 * `stableId` is assigned a temporary `#A<placeholderSequence>` here (1-based position in the
 * caller's array) — the *real* spend-sorted `#A/#B/#C` id is assigned afterwards, once every
 * campaign/adset/ad in the sync has been mapped, by `utils/StableIdAssigner.ts` (see
 * `PullCampaignData`). `adSets` starts empty; `AdSetMapper` results are attached by the caller
 * via `Campaign.withAdSets`.
 *
 * `objective` is parsed via `parseCampaignObjective`, never rejected: real bug fix, previously an
 * `objective` value outside AAOS's `CampaignObjective` enum (e.g. `OUTCOME_APP_PROMOTION`) failed
 * this mapper, which — since `MetaResponseMapper.mapCampaigns` short-circuits its loop on the
 * first `err` — aborted the *entire* ad account's campaign sync over one campaign AAOS doesn't
 * even act on. An unrecognized objective now maps to `CampaignObjective.UNKNOWN` and the campaign
 * still gets synced; nothing is masked by this since `UNKNOWN !== OUTCOME_LEADS` still correctly
 * trips `VerdictEngine`'s FIX rule (see that enum's docstring).
 */
export function mapCampaign(
  raw: MetaCampaign,
  adAccountId: AdAccountId,
  placeholderSequence: number,
): Result<Campaign, ValidationError> {
  if (!KNOWN_STATUSES.has(raw.status)) {
    return err(
      new ValidationError(
        `Unrecognized Meta campaign status "${raw.status}" for campaign ${raw.id}`,
      ),
    );
  }

  const stableIdResult = StableId.create("A", placeholderSequence);
  if (!stableIdResult.ok) {
    return err(stableIdResult.error);
  }

  const insightRow = raw.insights?.data[0];
  const spendResult = Spend.create(insightRow?.spend !== undefined ? Number(insightRow.spend) : 0);
  if (!spendResult.ok) {
    return err(spendResult.error);
  }

  return Campaign.create({
    id: CampaignId.generate(),
    stableId: stableIdResult.value,
    metaId: raw.id,
    adAccountId,
    name: raw.name,
    objective: parseCampaignObjective(raw.objective),
    status: raw.status as AdStatus,
    funnel: classifyFunnel(raw.name),
    branch: extractBranch(raw.name),
    spend: spendResult.value,
    adSets: [],
    createdAt: raw.created_time !== undefined ? new Date(raw.created_time) : new Date(),
  });
}
