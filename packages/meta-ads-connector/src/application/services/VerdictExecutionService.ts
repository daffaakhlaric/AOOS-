import { err, ok, type Result } from "@aos/common";

import type { IMetaAdsClient } from "../../contracts/IMetaAdsClient.js";
import type { IRateLimiter } from "../../contracts/IRateLimiter.js";
import type {
  ExecutionResult,
  IVerdictExecutor,
  VerdictExecutionInput,
} from "../../contracts/IVerdictExecutor.js";
import { MetaApiError } from "../../domain/errors/index.js";
import { CampaignObjective } from "../../domain/value-objects/CampaignObjective.js";
import { Verdict } from "../../domain/value-objects/Verdict.js";
import type { ExponentialBackoffRetry } from "../../infrastructure/retry/ExponentialBackoffRetry.js";
import { rupiahToCents } from "../../utils/CurrencyUtils.js";
import { callMetaApi } from "../use-cases/meta-api-call-helpers.js";

/** SCALE always raises the daily budget by exactly +20%, per the spec's Execute Actions mapping. */
const SCALE_FACTOR = 1.2;
/**
 * FIX's target objective. AAOS-W1D-S3: DSS Motor's real strategy is OUTCOME_LEADS + CTWA (lead
 * clicks the ad, lands straight in WhatsApp with Clara) — was `OUTCOME_ENGAGEMENT` before this
 * supplement.
 */
const FIX_OBJECTIVE = CampaignObjective.OUTCOME_LEADS;

/**
 * `IVerdictExecutor` implementation composing `IMetaAdsClient` calls, per the spec's
 * ExecuteVerdict mapping:
 *   PAUSE   → POST /{ad-id}      { status: "PAUSED" }
 *   SCALE   → POST /{adset-id}   { daily_budget: current * 1.2 }
 *   FIX     → POST /{campaign-id} { objective: "OUTCOME_LEADS" }
 *   REFRESH → no API call — ExecutionResult.action = "HUMAN_ACTION_REQUIRED"
 *   KEEP, REVIEW → no-op — ExecutionResult.action = "NO_ACTION"
 */
export class VerdictExecutionService implements IVerdictExecutor {
  constructor(
    private readonly client: IMetaAdsClient,
    private readonly rateLimiter: IRateLimiter,
    private readonly retry: ExponentialBackoffRetry,
  ) {}

  async execute(input: VerdictExecutionInput): Promise<Result<ExecutionResult, MetaApiError>> {
    switch (input.verdict) {
      case Verdict.PAUSE:
        return this.executePause(input);
      case Verdict.SCALE:
        return this.executeScale(input);
      case Verdict.FIX:
        return this.executeFix(input);
      case Verdict.REFRESH:
        return ok({
          action: "HUMAN_ACTION_REQUIRED",
          targetId: input.targetId,
          targetType: input.targetType,
        });
      case Verdict.KEEP:
      case Verdict.REVIEW:
        return ok({ action: "NO_ACTION", targetId: input.targetId, targetType: input.targetType });
      default:
        return ok({ action: "NO_ACTION", targetId: input.targetId, targetType: input.targetType });
    }
  }

  private async executePause(
    input: VerdictExecutionInput,
  ): Promise<Result<ExecutionResult, MetaApiError>> {
    const result = await callMetaApi(this.rateLimiter, this.retry, () =>
      this.client.pauseAd(input.targetId, input.accessToken),
    );
    if (!result.ok) {
      return err(result.error);
    }
    return ok({
      action: "PAUSED",
      targetId: input.targetId,
      targetType: input.targetType,
      newValue: "PAUSED",
    });
  }

  private async executeScale(
    input: VerdictExecutionInput,
  ): Promise<Result<ExecutionResult, MetaApiError>> {
    const currentIDR = input.currentDailyBudgetIDR ?? 0;
    const newIDR = input.requestedDailyBudgetIDR ?? Math.round(currentIDR * SCALE_FACTOR);
    if (input.requestedDailyBudgetIDR !== undefined) {
      if (
        input.targetType !== "adset" ||
        !input.campaignId ||
        !Number.isSafeInteger(currentIDR) ||
        currentIDR <= 0 ||
        !Number.isSafeInteger(newIDR) ||
        newIDR <= currentIDR
      ) {
        return err(new MetaApiError("INVALID_ABSOLUTE_BUDGET_TARGET"));
      }
      const live = await callMetaApi(this.rateLimiter, this.retry, () =>
        this.client.getAdSets(input.campaignId!, input.accessToken),
      );
      if (!live.ok) return err(live.error);
      const adSet = live.value.data.find((row) => row.id === input.targetId);
      if (
        !adSet ||
        adSet.status !== "ACTIVE" ||
        Number(adSet.daily_budget) !== rupiahToCents(currentIDR)
      ) {
        return err(new MetaApiError("BUDGET_OR_ADSET_STATE_CHANGED"));
      }
    }
    const newCents = rupiahToCents(newIDR);
    const result = await callMetaApi(this.rateLimiter, this.retry, () =>
      this.client.scaleAdSetBudget(input.targetId, newCents, input.accessToken),
    );
    if (!result.ok) {
      return err(result.error);
    }
    if (input.requestedDailyBudgetIDR !== undefined) {
      const verified = await callMetaApi(this.rateLimiter, this.retry, () =>
        this.client.getAdSets(input.campaignId!, input.accessToken),
      );
      if (
        !verified.ok ||
        Number(verified.value.data.find((row) => row.id === input.targetId)?.daily_budget) !==
          newCents
      ) {
        return err(
          new MetaApiError(
            "BUDGET_EXECUTION_UNCERTAIN: read-back did not confirm target; do not replay",
          ),
        );
      }
    }
    return ok({
      action: "SCALED",
      targetId: input.targetId,
      targetType: input.targetType,
      previousValue: currentIDR,
      newValue: newIDR,
    });
  }

  private async executeFix(
    input: VerdictExecutionInput,
  ): Promise<Result<ExecutionResult, MetaApiError>> {
    const result = await callMetaApi(this.rateLimiter, this.retry, () =>
      this.client.fixCampaignObjective(input.targetId, FIX_OBJECTIVE, input.accessToken),
    );
    if (!result.ok) {
      return err(result.error);
    }
    return ok({
      action: "FIXED",
      targetId: input.targetId,
      targetType: input.targetType,
      newValue: FIX_OBJECTIVE,
    });
  }
}
