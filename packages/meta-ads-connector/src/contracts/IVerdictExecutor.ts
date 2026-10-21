import type { Result } from "@aos/common";

import type { MetaApiError } from "../domain/errors/index.js";
import type { Verdict } from "../domain/value-objects/Verdict.js";

export type VerdictTargetType = "ad" | "adset" | "campaign";

/** The action actually taken (or not taken) for a given verdict — mirrors the spec's ExecuteVerdict mapping. */
export type ExecutionAction = "PAUSED" | "SCALED" | "FIXED" | "HUMAN_ACTION_REQUIRED" | "NO_ACTION";

export interface ExecutionResult {
  readonly action: ExecutionAction;
  readonly targetId: string;
  readonly targetType: VerdictTargetType;
  readonly previousValue?: string | number;
  readonly newValue?: string | number;
}

export interface VerdictExecutionInput {
  readonly verdict: Verdict;
  readonly targetId: string;
  readonly targetType: VerdictTargetType;
  readonly accessToken: string;
  /** Required only for SCALE — the adset's current daily budget in whole IDR, used to compute the +20% target. */
  readonly currentDailyBudgetIDR?: number;
  /** Absolute reviewed target; never recomputed from a changed live budget. */
  readonly requestedDailyBudgetIDR?: number;
  /** Required for absolute scaling: validates membership and reads back the ad set. */
  readonly campaignId?: string;
}

/**
 * Port for executing an optimization verdict against the Meta API. The only implementation is
 * `application/services/VerdictExecutionService.ts`, which composes `IMetaAdsClient` calls.
 */
export interface IVerdictExecutor {
  execute(input: VerdictExecutionInput): Promise<Result<ExecutionResult, MetaApiError>>;
}
