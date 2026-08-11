import { err, ok, type Result } from "@aos/common";

import type { IMetaAdsClient } from "../../contracts/IMetaAdsClient.js";
import type { IRateLimiter } from "../../contracts/IRateLimiter.js";
import type {
  ExecutionResult,
  IVerdictExecutor,
  VerdictExecutionInput,
} from "../../contracts/IVerdictExecutor.js";
import { type MetaApiError } from "../../domain/errors/index.js";
import { CampaignObjective } from "../../domain/value-objects/CampaignObjective.js";
import { Verdict } from "../../domain/value-objects/Verdict.js";
import type { ExponentialBackoffRetry } from "../../infrastructure/retry/ExponentialBackoffRetry.js";
import { rupiahToCents } from "../../utils/CurrencyUtils.js";
import { callMetaApi } from "../use-cases/meta-api-call-helpers.js";

/** SCALE always raises the daily budget by exactly +20%, per the spec's Execute Actions mapping. */
const SCALE_FACTOR = 1.2;
/** REFRESH's FIX target objective, per the spec's Execute Actions mapping. */
const FIX_OBJECTIVE = CampaignObjective.OUTCOME_ENGAGEMENT;

/**
 * `IVerdictExecutor` implementation composing `IMetaAdsClient` calls, per the spec's
 * ExecuteVerdict mapping:
 *   PAUSE   → POST /{ad-id}      { status: "PAUSED" }
 *   SCALE   → POST /{adset-id}   { daily_budget: current * 1.2 }
 *   FIX     → POST /{campaign-id} { objective: "OUTCOME_ENGAGEMENT" }
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
    const newIDR = Math.round(currentIDR * SCALE_FACTOR);
    const newCents = rupiahToCents(newIDR);
    const result = await callMetaApi(this.rateLimiter, this.retry, () =>
      this.client.scaleAdSetBudget(input.targetId, newCents, input.accessToken),
    );
    if (!result.ok) {
      return err(result.error);
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
