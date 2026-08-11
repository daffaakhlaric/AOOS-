import type { Branch, Funnel, Verdict } from "@aos/meta-ads-connector";

import type { AdAngle } from "../domain/value-objects/AdAngle.js";

/** The concrete action kind behind a `CampaignDecision`, independent of its `DecisionType` routing. */
export type DecisionActionKind =
  "PAUSE" | "SCALE" | "FIX" | "REFRESH" | "NO_ACTION" | "REALLOCATE_BUDGET" | "CREATE_CAMPAIGN";

/** What a `CampaignDecision` targets — a single Meta entity (ad/adset/campaign), or a portfolio-wide finding with no single Meta id. */
export type DecisionTargetType = "ad" | "adset" | "campaign" | "portfolio";

/** Urgency band used by `CreativeBrief.urgency`. */
export type CreativeUrgency = "HIGH" | "MEDIUM" | "LOW";

/** Creative format recommendation used by `CreativeBrief.formats`. */
export type CreativeFormat = "VIDEO_15S" | "VIDEO_30S" | "IMAGE_SQUARE" | "IMAGE_STORY";

/** `EscalationRequest.status` — the human-approval queue's lifecycle. */
export type EscalationStatus = "PENDING" | "APPROVED" | "REJECTED";

/** `AgentMemory.escalationOutcomes` value — mirrors `EscalationStatus`'s resolved subset. */
export type EscalationOutcome = "APPROVED" | "REJECTED";

/** Input describing a single per-ad finding fed into `DecisionEngineService` by `VerdictDecisionEngine`. */
export interface PerAdFinding {
  readonly adId: string;
  readonly targetId: string;
  readonly targetType: DecisionTargetType;
  readonly verdict: Verdict;
  readonly branch: Branch;
  readonly unit: string;
  readonly spendIDR: number;
  readonly conversations: number;
  readonly rphChatIDR: number | null;
  readonly rphD3IDR: number | null;
  readonly budgetIncreaseIDR?: number;
  readonly currentDailyBudgetIDR?: number;
  /**
   * AAOS-W1D-S1S2 (S1) addition — optional funnel/angle classification for this ad, used by
   * `VerdictDecisionEngine`'s blended-avg lookup (`memory.performanceBaselines.get(
   * `${branch}-${funnel}-${angle}`)`). Optional and additive: `OptimizationPipeline` does not
   * populate these yet (documented limitation — see package report), so blended-avg only
   * activates for callers that supply them directly (e.g. this supplement's own tests).
   */
  readonly funnel?: Funnel;
  readonly angle?: AdAngle;
}

/** Input describing a single portfolio-level finding fed into `DecisionEngineService` by `BudgetOptimizer`. */
export interface PortfolioFinding {
  readonly key: string;
  readonly type: Extract<DecisionActionKind, "REALLOCATE_BUDGET" | "CREATE_CAMPAIGN">;
  readonly description: string;
  readonly reallocationAmountIDR?: number;
  readonly fromLabel?: string;
  readonly toLabel?: string;
}
