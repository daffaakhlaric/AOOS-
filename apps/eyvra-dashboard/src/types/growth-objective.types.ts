/**
 * Mirrors `apps/aaos-api`'s `modules/growth-objectives` DTOs field-for-field (EYVRA — SAMANTHA V2
 * Phase 15/16), verified directly against that module's real, currently-shipped
 * `dto/growth-objective.dto.ts` and its real `domain/reverse-funnel.ts`/`domain/feasibility.ts`/
 * `domain/objective-progress.ts`/`domain/pacing.ts` — never guessed. The wire contract between
 * this app's `/api/growth-objectives/*` route handlers and the real backend.
 *
 * NOT to be confused with the older, unrelated `/objective` feature (`types` live inline in
 * `ObjectiveClient.tsx`/`ObjectiveForm.tsx` there) — that's `property_objective`/`ObjectiveDto`
 * business-context (`targetCpl`, budget suggestion), a completely different concept. This file is
 * ONLY for the new `growth_objectives` business-GOAL tracker ("get N Hot Leads by date X").
 *
 * Phase 16 expands `forecast`/`progress` from Phase 15's placeholder `unknown`/narrow shapes into
 * their real, full domain shapes below — this app's detail view now renders their internal
 * structure (reverse funnel, feasibility, pacing), so the full shape is needed, not just an
 * honest-presence check.
 */

/** Real `EstimatedRange` (`domain/reverse-funnel.ts`). */
export interface EstimatedRange {
  readonly min: number;
  readonly expected: number;
  readonly max: number;
}

/** Real `ReverseFunnelResult` (`domain/reverse-funnel.ts`) — see that file's own doc for the honest-undefined rules on each field. */
export interface ReverseFunnelResult {
  readonly conversionRate?: number;
  readonly estimatedRequiredRawLeads?: EstimatedRange;
  readonly estimatedMediaSpendIdr?: EstimatedRange;
  readonly confidence: number;
}

/** Real `FeasibilityStatus` (`domain/feasibility.ts`). */
export const FEASIBILITY_STATUSES = [
  "ACHIEVABLE",
  "AGGRESSIVE",
  "AT_RISK",
  "UNLIKELY",
  "INSUFFICIENT_DATA",
] as const;
export type FeasibilityStatus = (typeof FEASIBILITY_STATUSES)[number];

/** Real `FeasibilityResult["options"]` element values (`domain/feasibility.ts`). */
export const FEASIBILITY_OPTIONS = [
  "INCREASE_BUDGET",
  "REDUCE_TARGET",
  "IMPROVE_CONVERSION",
  "EXTEND_TIMELINE",
] as const;
export type FeasibilityOption = (typeof FEASIBILITY_OPTIONS)[number];

/** Real `FeasibilityResult` (`domain/feasibility.ts`). */
export interface FeasibilityResult {
  readonly status: FeasibilityStatus;
  readonly confidence: number;
  readonly reasons: readonly string[];
  readonly options: readonly FeasibilityOption[];
}

/** Real `GrowthObjectiveForecastDto` (`dto/growth-objective.dto.ts`) — the persisted `{reverseFunnel, feasibility}` object `/analyze` computes. */
export interface GrowthObjectiveForecastDto {
  readonly reverseFunnel: ReverseFunnelResult;
  readonly feasibility: FeasibilityResult;
}

/** Real `ObjectiveProgressStatus` (`domain/objective-progress.ts`). */
export const OBJECTIVE_PROGRESS_STATUSES = [
  "COMPLETED",
  "ON_TRACK",
  "AT_RISK",
  "OFF_TRACK",
] as const;
export type ObjectiveProgressStatus = (typeof OBJECTIVE_PROGRESS_STATUSES)[number];

/** Real `ObjectiveProgressResult` (`domain/objective-progress.ts`) — see that file's own doc for the honest-undefined rule on `requiredDailyPace`. */
export interface ObjectiveProgressResult {
  readonly status: ObjectiveProgressStatus;
  readonly progressPct: number;
  readonly daysElapsed: number;
  readonly daysRemaining: number;
  readonly currentDailyPace: number;
  readonly requiredDailyPace?: number;
  readonly projectedFinalCount: number;
}

/** Real `PacingStatus` (`domain/pacing.ts`). */
export const PACING_STATUSES = ["UNDER_PACING", "ON_PACE", "OVER_PACING", "UNKNOWN"] as const;
export type PacingStatus = (typeof PACING_STATUSES)[number];

/** Real `PacingResult` (`domain/pacing.ts`) — see that file's own doc for the honest-`UNKNOWN`/undefined rules on each optional field. */
export interface PacingResult {
  readonly status: PacingStatus;
  readonly expectedSpendToDateIdr?: number;
  readonly actualSpendIdr: number;
  readonly pacingPct?: number;
  readonly daysRemaining: number;
  readonly daysElapsed: number;
  readonly requiredDailyPaceIdr?: number;
  readonly projectedEndOfPeriodSpendIdr?: number;
}

/** Real `PacingResponseDto` (`dto/growth-objective.dto.ts`) — `GET /:id/pacing`'s response. `spendSource` makes honestly visible which real spend the pacing was computed from — see that file's own doc. */
export interface PacingResponseDto {
  readonly objectiveId: string;
  readonly pacing: PacingResult;
  readonly spendSource: "MATCHED_CAMPAIGNS" | "ACCOUNT_WIDE";
}

export const GROWTH_OBJECTIVE_METRICS = ["HOT_LEADS"] as const;
export type GrowthObjectiveMetric = (typeof GROWTH_OBJECTIVE_METRICS)[number];

export const BUDGET_MODES = ["GOAL_FIRST", "BUDGET_FIRST", "BALANCED"] as const;
export type BudgetMode = (typeof BUDGET_MODES)[number];

export const AREA_STRATEGIES = ["SAMANTHA", "MANUAL"] as const;
export type AreaStrategy = (typeof AREA_STRATEGIES)[number];

export const AUTOMATION_MODES = ["ADVISOR", "COPILOT", "AUTOPILOT_GUARDED", "AUTONOMOUS"] as const;
export type AutomationMode = (typeof AUTOMATION_MODES)[number];

/** Mirrors `054_growth_objectives.sql`'s `status` CHECK column-for-column (see the real DTO's own comment — includes states no Phase 1 Part A code path can reach yet). */
export const GROWTH_OBJECTIVE_STATUSES = [
  "DRAFT",
  "ANALYZING",
  "PLANNED",
  "ACTIVE",
  "ON_TRACK",
  "AT_RISK",
  "OFF_TRACK",
  "REPLANNING",
  "COMPLETED",
  "PAUSED",
] as const;
export type GrowthObjectiveStatus = (typeof GROWTH_OBJECTIVE_STATUSES)[number];

export interface GrowthObjectiveResponseDto {
  readonly id: string;
  readonly tenantId: string;
  readonly metric: GrowthObjectiveMetric;
  readonly targetValue: number;
  readonly startDate: string;
  readonly endDate: string;
  readonly budgetMode: BudgetMode;
  readonly maxBudgetIdr?: number;
  readonly focusListingIds: readonly string[];
  readonly areaStrategy: AreaStrategy;
  readonly manualAreas: readonly string[];
  readonly automationMode: AutomationMode;
  readonly status: GrowthObjectiveStatus;
  /** The real `GrowthObjectiveForecastDto` `/analyze` computes and persists (`055_growth_objective_forecast.sql`). `undefined` until `/analyze` has been called at least once — never a fabricated default. */
  readonly forecast?: GrowthObjectiveForecastDto;
  readonly forecastComputedAt?: string;
  /** The real `ObjectiveProgressResult` (`057_growth_objective_progress.sql`); `undefined` until `/check-progress` has been called at least once — never a fabricated default. */
  readonly progress?: ObjectiveProgressResult;
  readonly progressCheckedAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface GrowthObjectiveListResponseDto {
  readonly objectives: readonly GrowthObjectiveResponseDto[];
}

/**
 * `POST /api/v1/growth-objectives` body. `status` is deliberately NOT accepted — every objective
 * is created `DRAFT` server-side, never client-chosen (see the real
 * `CreateGrowthObjectiveBodySchema`'s own comment).
 *
 * PHASE-SCOPE DEVIATION (deliberate): `focusListingIds`/`manualAreas` are real, optional array
 * fields on the backend DTO, but this phase's create form omits a listing/area picker UI
 * entirely — a proper picker is real, future, separately-scoped work. Both fields are simply
 * never sent from this app's form (omitted, not sent as `[]`), which the backend's own `.optional()`
 * schema accepts identically to an explicit empty array.
 */
export interface CreateGrowthObjectiveInput {
  readonly metric: "HOT_LEADS";
  readonly targetValue: number;
  readonly startDate: string;
  readonly endDate: string;
  readonly budgetMode: BudgetMode;
  readonly maxBudgetIdr?: number;
  readonly focusListingIds?: readonly string[];
  readonly areaStrategy: AreaStrategy;
  readonly manualAreas?: readonly string[];
  readonly automationMode: AutomationMode;
}
