/**
 * Mirrors `apps/aaos-api`'s `modules/growth-objectives` DTOs field-for-field (EYVRA — SAMANTHA V2
 * Phase 15), verified directly against that module's real, currently-shipped
 * `dto/growth-objective.dto.ts` — never guessed. The wire contract between this app's
 * `/api/growth-objectives/*` route handlers and the real backend.
 *
 * NOT to be confused with the older, unrelated `/objective` feature (`types` live inline in
 * `ObjectiveClient.tsx`/`ObjectiveForm.tsx` there) — that's `property_objective`/`ObjectiveDto`
 * business-context (`targetCpl`, budget suggestion), a completely different concept. This file is
 * ONLY for the new `growth_objectives` business-GOAL tracker ("get N Hot Leads by date X").
 *
 * `forecast`/`progress` (real `GrowthObjectiveForecastDto`/`ObjectiveProgressResult` shapes) are
 * intentionally typed as `unknown` here — this phase is list + create + read-only detail view
 * only; no UI in this phase renders their internal structure beyond an honest presence check
 * (`progress?.progressPct`, read narrowly where needed), so re-deriving their full real shape
 * (`ReverseFunnelResult`/`FeasibilityResult`/`ObjectiveProgressResult`, each itself a real
 * domain type in `aaos-api`) is out of scope — wiring `/analyze`/`/check-progress` triggers and a
 * real forecast/progress detail view is explicitly Phase 16.
 */

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
  /** `undefined` until `/analyze` has been called at least once — never a fabricated default. */
  readonly forecast?: unknown;
  readonly forecastComputedAt?: string;
  /** The real `ObjectiveProgressResult` (`057_growth_objective_progress.sql`); `undefined` until `/check-progress` has been called at least once — never a fabricated default. This phase reads only `progressPct` off it (see `GrowthObjectivesClient.tsx`). */
  readonly progress?: { readonly progressPct?: number };
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
