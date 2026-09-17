import { z } from "zod";

/**
 * `054_growth_objectives.sql`'s `metric` CHECK — a `z.literal`, not a `z.enum` of several values,
 * because only `HOT_LEADS` is real, queryable data in this codebase's CRM model today (see that
 * migration's header doc (a)). The raw SAMANTHA V2 spec imagines QUALIFIED_LEADS/APPOINTMENTS/
 * SURVEYS/BOOKINGS as selectable metrics — none of those exist as real data (no "qualified" lead
 * stage, no appointment/survey/booking table anywhere in `aaos-api`), and this session's explicit
 * user decision ("CRM belakangan") keeps CRM-stage additions out of scope for this phase. A
 * `z.literal` documents this honestly instead of a `z.enum` that would silently accept values with
 * no real backing data.
 */
export const GROWTH_OBJECTIVE_METRICS = ["HOT_LEADS"] as const;
export type GrowthObjectiveMetric = (typeof GROWTH_OBJECTIVE_METRICS)[number];

export const BUDGET_MODES = ["GOAL_FIRST", "BUDGET_FIRST", "BALANCED"] as const;
export type BudgetMode = (typeof BUDGET_MODES)[number];

export const AREA_STRATEGIES = ["SAMANTHA", "MANUAL"] as const;
export type AreaStrategy = (typeof AREA_STRATEGIES)[number];

export const AUTOMATION_MODES = ["ADVISOR", "COPILOT", "AUTOPILOT_GUARDED", "AUTONOMOUS"] as const;
export type AutomationMode = (typeof AUTOMATION_MODES)[number];

/** Full lifecycle — mirrors `054_growth_objectives.sql`'s `status` CHECK column-for-column, including states no Phase 1 Part A code path can reach yet (see that migration's comment on the column). */
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

/** `POST /api/v1/growth-objectives` body. `status` is deliberately NOT accepted here — every objective is created `DRAFT` by `GrowthObjectivesService.create`, never client-chosen. */
export const CreateGrowthObjectiveBodySchema = z
  .object({
    metric: z.literal("HOT_LEADS"),
    targetValue: z.number().int().positive("targetValue must be a positive integer"),
    startDate: z.string().min(1, "startDate must not be empty"),
    endDate: z.string().min(1, "endDate must not be empty"),
    budgetMode: z.enum(BUDGET_MODES),
    maxBudgetIdr: z.number().int().nonnegative().optional(),
    focusListingIds: z.array(z.string().min(1)).optional(),
    areaStrategy: z.enum(AREA_STRATEGIES),
    manualAreas: z.array(z.string().min(1)).optional(),
    automationMode: z.enum(AUTOMATION_MODES),
  })
  .refine((body) => body.endDate >= body.startDate, {
    message: "endDate must be on or after startDate",
    path: ["endDate"],
  });
export type CreateGrowthObjectiveBodyDto = z.infer<typeof CreateGrowthObjectiveBodySchema>;

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
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface GrowthObjectiveListResponseDto {
  readonly objectives: readonly GrowthObjectiveResponseDto[];
}

/** Row shape this mapper accepts — kept structurally compatible with `GrowthObjectiveRow` (avoids a direct infra-layer import into `dto/`, same layering `listing.dto.ts` keeps from `listing.repository.ts`). */
export interface GrowthObjectiveRowLike {
  readonly id: string;
  readonly tenant_id: string;
  readonly metric: string;
  readonly target_value: number;
  readonly start_date: string;
  readonly end_date: string;
  readonly budget_mode: string;
  readonly max_budget_idr: number | null;
  readonly focus_listing_ids: readonly string[];
  readonly area_strategy: string;
  readonly manual_areas: readonly string[];
  readonly automation_mode: string;
  readonly status: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export function toGrowthObjectiveResponseDto(
  row: GrowthObjectiveRowLike,
): GrowthObjectiveResponseDto {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    metric: row.metric as GrowthObjectiveMetric,
    targetValue: row.target_value,
    startDate: row.start_date,
    endDate: row.end_date,
    budgetMode: row.budget_mode as BudgetMode,
    ...(row.max_budget_idr !== null ? { maxBudgetIdr: row.max_budget_idr } : {}),
    focusListingIds: row.focus_listing_ids,
    areaStrategy: row.area_strategy as AreaStrategy,
    manualAreas: row.manual_areas,
    automationMode: row.automation_mode as AutomationMode,
    status: row.status as GrowthObjectiveStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
