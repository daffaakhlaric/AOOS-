import { err, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

import { AdSet } from "../domain/entities/AdSet.js";
import type { AdAccountId } from "../domain/value-objects/AdAccountId.js";
import { AdSetId } from "../domain/value-objects/AdSetId.js";
import { AdStatus } from "../domain/value-objects/AdStatus.js";
import { Budget } from "../domain/value-objects/Budget.js";
import type { CampaignId } from "../domain/value-objects/CampaignId.js";
import { Spend } from "../domain/value-objects/Spend.js";
import { StableId } from "../domain/value-objects/StableId.js";
import type { MetaAdSet } from "../types/MetaApiTypes.js";
import { extractBranch } from "../utils/BranchExtractor.js";
import { centsToRupiah } from "../utils/CurrencyUtils.js";

const KNOWN_STATUSES: ReadonlySet<string> = new Set(Object.values(AdStatus));

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
  });
}
