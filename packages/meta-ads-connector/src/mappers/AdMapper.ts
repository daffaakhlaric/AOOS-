import { err, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

import { Ad } from "../domain/entities/Ad.js";
import type { AdAccountId } from "../domain/value-objects/AdAccountId.js";
import { AdId } from "../domain/value-objects/AdId.js";
import type { AdSetId } from "../domain/value-objects/AdSetId.js";
import { AdStatus } from "../domain/value-objects/AdStatus.js";
import type { Branch } from "../domain/value-objects/Branch.js";
import type { CampaignId } from "../domain/value-objects/CampaignId.js";
import type { Funnel } from "../domain/value-objects/Funnel.js";
import { StableId } from "../domain/value-objects/StableId.js";
import { Verdict } from "../domain/value-objects/Verdict.js";
import type { MetaAd } from "../types/MetaApiTypes.js";

import { mapInsightRowToMetrics } from "./MetricsMapper.js";

const KNOWN_STATUSES: ReadonlySet<string> = new Set(Object.values(AdStatus));
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Maps a single (already Zod-validated) raw Meta ad into the AAOS `Ad` entity.
 *
 * Judgment call: neither Funnel Classification nor Branch Extraction rules are defined "from ad
 * name" in the spec (only "from campaign name" and "from campaign/adset name", respectively) —
 * an Ad simply **inherits** its `funnel` from the parent Campaign and its `branch` from the
 * parent AdSet (the more specific of the two ancestors that has a documented Branch Extraction
 * rule), rather than re-deriving from the ad's own creative/name text.
 *
 * `verdict` is assigned a placeholder `Verdict.REVIEW` here — the real verdict requires the full
 * computed `AdMetrics` (`rphChat`, `frequency`, spend) plus the parent Campaign's `objective`,
 * which `VerdictEngine` computes; the caller (`PullCampaignData`) re-assigns it via `Ad.withVerdict`
 * once the campaign's objective is known.
 *
 * `now` is passed in explicitly (rather than read via `Date.now()`/`new Date()` inside this pure
 * function) so `daysSinceCreation` is deterministic and test-controllable, mirroring the same
 * injectable-clock discipline used by the rate limiter and retry modules.
 */
export function mapAd(
  raw: MetaAd,
  campaignId: CampaignId,
  adSetId: AdSetId,
  adAccountId: AdAccountId,
  inheritedFunnel: Funnel,
  inheritedBranch: Branch,
  placeholderSequence: number,
  now: Date,
): Result<Ad, ValidationError> {
  if (!KNOWN_STATUSES.has(raw.status)) {
    return err(new ValidationError(`Unrecognized Meta ad status "${raw.status}" for ad ${raw.id}`));
  }

  const stableIdResult = StableId.create("C", placeholderSequence);
  if (!stableIdResult.ok) {
    return err(stableIdResult.error);
  }

  const metricsResult = mapInsightRowToMetrics(raw.insights?.data[0]);
  if (!metricsResult.ok) {
    return err(metricsResult.error);
  }

  const createdAt = new Date(raw.created_time);
  if (Number.isNaN(createdAt.getTime())) {
    return err(new ValidationError(`Ad.created_time is not a valid date: ${raw.created_time}`));
  }
  const daysSinceCreation = Math.max(
    0,
    Math.floor((now.getTime() - createdAt.getTime()) / MS_PER_DAY),
  );

  return Ad.create({
    id: AdId.generate(),
    stableId: stableIdResult.value,
    metaId: raw.id,
    adSetId,
    campaignId,
    adAccountId,
    name: raw.name,
    status: raw.status as AdStatus,
    funnel: inheritedFunnel,
    branch: inheritedBranch,
    metrics: metricsResult.value,
    verdict: Verdict.REVIEW,
    createdAt,
    daysSinceCreation,
  });
}
