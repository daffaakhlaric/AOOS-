import { err, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

import { AdSet, type LearningStatus } from "../domain/entities/AdSet.js";
import type { AdAccountId } from "../domain/value-objects/AdAccountId.js";
import { AdSetId } from "../domain/value-objects/AdSetId.js";
import { AdStatus } from "../domain/value-objects/AdStatus.js";
import { Budget } from "../domain/value-objects/Budget.js";
import type { CampaignId } from "../domain/value-objects/CampaignId.js";
import { Spend } from "../domain/value-objects/Spend.js";
import { StableId } from "../domain/value-objects/StableId.js";
import type {
  MetaAdSet,
  MetaAdSetLearningStageInfo,
  MetaAdSetTargeting,
} from "../types/MetaApiTypes.js";
import { classifyAudience, type AudienceTargetingSpec } from "../utils/AudienceClassifier.js";
import { extractBranch } from "../utils/BranchExtractor.js";
import { centsToRupiah } from "../utils/CurrencyUtils.js";

const KNOWN_STATUSES: ReadonlySet<string> = new Set(Object.values(AdStatus));

const KNOWN_LEARNING_STATUSES: ReadonlySet<string> = new Set([
  "LEARNING",
  "LEARNING_LIMITED",
  "SUCCESS",
]);

/**
 * Maps the raw `learning_stage_info` object into the domain's `LearningStatus`. Honest degrade:
 * `undefined` when the whole object is absent (real "Meta never reported this" case — see
 * `types/MetaApiTypes.ts`'s `MetaAdSetLearningStageInfoSchema` docstring), when `status` itself is
 * absent, or when `status` is a string outside the real, documented 3-member vocabulary this
 * package knows about — NEVER fabricates/guesses a status value, and never fails the whole adset
 * parse closed over an unrecognized future Meta status string.
 */
function mapLearningStatus(
  raw: MetaAdSetLearningStageInfo | undefined,
): LearningStatus | undefined {
  if (raw?.status === undefined || !KNOWN_LEARNING_STATUSES.has(raw.status)) {
    return undefined;
  }
  return raw.status as LearningStatus;
}

/**
 * Maps the raw `targeting` object into `AudienceClassifier`'s standalone `AudienceTargetingSpec`
 * input type (reused as-is, not a second parallel type — see that file's own docstring). Every
 * `custom_audiences[]` entry is mapped with `subtype: undefined`: Meta's real targeting-read
 * response never carries a `subtype` on this array (see `types/MetaApiTypes.ts`'s
 * `MetaAdSetTargetingSchema` docstring for the verified, honestly-documented gap) — `undefined`
 * safely falls through `classifyAudience`'s own already-designed "unrecognized subtype →
 * CUSTOM_CRM" bucket-3 rule rather than fabricating a subtype value that isn't real.
 */
function mapTargeting(raw: MetaAdSetTargeting | undefined): AudienceTargetingSpec | undefined {
  if (raw === undefined) {
    return undefined;
  }
  return {
    // `subtype` is a required field on `AudienceTargetingCustomAudience`, but Meta's real
    // targeting-read response never supplies it (see docstring above) — "UNKNOWN" is a
    // deliberately-non-real sentinel that never equals "LOOKALIKE" and is never a member of
    // `classifyAudience`'s RETARGETING_SUBTYPES set, so every entry here correctly and safely
    // falls through to bucket 3 (CUSTOM_CRM) without fabricating a subtype value that isn't real.
    customAudiences: raw.custom_audiences?.map(() => ({ subtype: "UNKNOWN" })),
    flexibleSpec: raw.flexible_spec?.map((entry) => ({
      interests: entry.interests?.map((interest) => ({ id: interest.id, name: interest.name })),
    })),
  };
}

/**
 * Maps a single (already Zod-validated) raw Meta adset into the AAOS `AdSet` entity. `stableId`
 * is a temporary placeholder, re-assigned by `StableIdAssigner` — see `CampaignMapper`'s
 * docstring for the same convention. `ads` starts empty; attached by the caller via `AdSet.withAds`.
 *
 * `daily_budget` is converted from Meta cents to whole Rupiah via `CurrencyUtils.centsToRupiah`
 * — Meta's budget fields are always in the account's currency's smallest subunit (cents for IDR
 * in Meta's accounting, even though IDR has no everyday minor unit).
 */
export function mapAdSet(
  raw: MetaAdSet,
  campaignId: CampaignId,
  adAccountId: AdAccountId,
  placeholderSequence: number,
): Result<AdSet, ValidationError> {
  if (!KNOWN_STATUSES.has(raw.status)) {
    return err(
      new ValidationError(`Unrecognized Meta adset status "${raw.status}" for adset ${raw.id}`),
    );
  }

  const stableIdResult = StableId.create("B", placeholderSequence);
  if (!stableIdResult.ok) {
    return err(stableIdResult.error);
  }

  const budgetCents = raw.daily_budget !== undefined ? Number(raw.daily_budget) : 0;
  const budgetResult = Budget.create(Number.isFinite(budgetCents) ? centsToRupiah(budgetCents) : 0);
  if (!budgetResult.ok) {
    return err(budgetResult.error);
  }

  const insightRow = raw.insights?.data[0];
  const spendResult = Spend.create(insightRow?.spend !== undefined ? Number(insightRow.spend) : 0);
  if (!spendResult.ok) {
    return err(spendResult.error);
  }

  return AdSet.create({
    id: AdSetId.generate(),
    stableId: stableIdResult.value,
    metaId: raw.id,
    campaignId,
    adAccountId,
    name: raw.name,
    status: raw.status as AdStatus,
    dailyBudget: budgetResult.value,
    branch: extractBranch(raw.name),
    spend: spendResult.value,
    ads: [],
    audienceLabel: classifyAudience(mapTargeting(raw.targeting)),
    learningStatus: mapLearningStatus(raw.learning_stage_info),
  });
}
