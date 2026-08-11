import type { Objective, ObjectiveProgress } from "@aos/objective-engine";

/**
 * `@aos/objective-engine` exports `Objective`/`ObjectiveProgress` only as *types* (their class
 * values, and every Value Object they're built from, are never exported — see that package's own
 * `index.ts`), matching the same documented pattern `@aos/meta-ads-connector` uses for
 * `AdAccount`. This package's `RunOptimizationCycle`/`DailyDigestBuilder` only ever *read* a
 * handful of properties off these two types (never call their entity methods), so these fixtures
 * assemble minimal object literals exposing exactly those properties/methods, asserted via
 * `as unknown as X` since both types are nominally typed (private constructors).
 */
export function buildObjectiveFixture(overrides?: {
  readonly targetHotLeads?: number;
  readonly budgetAllocationIDR?: number;
}): Objective {
  return {
    id: { toString: () => "objective-1" },
    tenantId: "dss-motor",
    targetHotLeads: { toNumber: () => overrides?.targetHotLeads ?? 50 },
    budgetAllocation: { toNumber: () => overrides?.budgetAllocationIDR ?? 30_000_000 },
  } as unknown as Objective;
}

export function buildObjectiveProgressFixture(overrides?: {
  readonly currentHotLeads?: number;
  readonly progressPercentage?: number;
  readonly forecastedHotLeads?: number;
  readonly onTrackStatus?: "ON_TRACK" | "AT_RISK" | "OFF_TRACK";
  readonly currentSpendIDR?: number;
  readonly budgetBurnRateIDR?: number;
  readonly daysRemaining?: number;
}): ObjectiveProgress {
  return {
    objectiveId: { toString: () => "objective-1" },
    currentHotLeads: overrides?.currentHotLeads ?? 12,
    currentSpend: { toNumber: () => overrides?.currentSpendIDR ?? 8_500_000 },
    daysElapsed: 9,
    daysRemaining: overrides?.daysRemaining ?? 22,
    progressPercentage: { toNumber: () => overrides?.progressPercentage ?? 24 },
    dailyRunRate: 1.3,
    requiredDailyRunRate: 1.7,
    forecastedHotLeads: { toNumber: () => overrides?.forecastedHotLeads ?? 46 },
    budgetBurnRate: overrides?.budgetBurnRateIDR ?? 1_062_500,
    projectedBudgetAtEnd: { toNumber: () => 25_500_000 },
    onTrackStatus: overrides?.onTrackStatus ?? "AT_RISK",
    updatedAt: new Date("2026-08-09T00:00:00.000Z"),
  } as unknown as ObjectiveProgress;
}
