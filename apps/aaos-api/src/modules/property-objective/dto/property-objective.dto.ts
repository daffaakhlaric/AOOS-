import { z } from "zod";

/**
 * `POST /api/v1/property-objective` body — the genuinely SEPARATE PROPERTY equivalent of
 * `CreateObjectiveBodySchema` (`modules/objective/dto/create-objective.dto.ts`), per
 * docs/PROMPT-AAOS-TENANT-SCOPING-AND-PROPERTY-OBJECTIVE.md's Phase O1. Deliberately NOT a
 * discriminated union / `isProperty` branch of the AUTOMOTIVE schema — same reasoning
 * `create-property-campaign.dto.ts`'s own docstring gives for `CreatePropertyCampaignBodySchema`.
 *
 * `budgetAllocation` is REQUIRED here, not optional. The design doc's own draft suggested making it
 * optional (reasoning: "the real-time suggestion flow may supply it, or a human may still type one
 * manually"), but that reasoning doesn't actually require optionality on THIS schema — the
 * suggestion flow (`GET /property-objective/budget-suggestion`) is a separate, prior HTTP call the
 * frontend makes; by the time the frontend POSTs here, it always has a concrete number in hand
 * (either the fetched suggestion, possibly edited, or a manually-typed one) to put in the form
 * field. Making `budgetAllocation` optional here would mean the SERVER would have to silently
 * invent a number when it's missing — exactly what Finding 4 says never to do ("never a fabricated
 * default number"). So the honest contract is: `budgetAllocation` is always required and > 0
 * (mirrors `objective-engine`'s own real "0 legitimately allowed at the Value Object level, > 0
 * enforced at the use-case boundary" pattern — this table has no shared Value Object, so `.positive()`
 * here IS that boundary enforcement); only `budgetSource` varies to record whether that final number
 * came from a human typing it or from accepting Samantha's computed suggestion.
 */
export const CreatePropertyObjectiveBodySchema = z.object({
  targetHotLeads: z.number().positive(),
  budgetAllocation: z.number().positive(),
  /** Defaults to `MANUAL` — the frontend only ever sends `SAMANTHA_SUGGESTED` when the submitted `budgetAllocation` came from `GET /property-objective/budget-suggestion` (whether or not it was edited afterward). */
  budgetSource: z.enum(["MANUAL", "SAMANTHA_SUGGESTED"]).optional().default("MANUAL"),
  focusListings: z.array(z.string().min(1)).min(1),
  areaPriorities: z.array(z.string().min(1)).min(1),
});

export type CreatePropertyObjectiveBodyDto = z.infer<typeof CreatePropertyObjectiveBodySchema>;

/**
 * `PATCH /api/v1/property-objective/business-context` body (AAOS LOOP UPGRADE, Sprint 6 Prompt 15).
 * All 3 numbers are optional individually (a manager may fill them in one at a time), but the
 * cross-field invariant is enforced whenever both CPL numbers are present in the SAME request:
 * `breakevenCpl` must be strictly greater than `targetCpl` (spec's own explicit validation
 * requirement — "harus > target_cpl"). This does NOT re-validate against whatever is already
 * persisted when only one of the two is sent in a given request (this table has no DB-level
 * cross-column CHECK either, per `043_property_objectives_business_context.sql`'s own doc) — a
 * caller that wants the invariant enforced against a partially-filled existing row should send both
 * fields together, which `PropertyObjectiveForm.tsx`'s single "Konteks Bisnis" card always does.
 */
export const UpdateBusinessContextBodySchema = z
  .object({
    avgDealValue: z.number().nonnegative().optional(),
    targetCpl: z.number().nonnegative().optional(),
    breakevenCpl: z.number().nonnegative().optional(),
    updatedBy: z.string().min(1).optional(),
  })
  .refine(
    (body) =>
      body.targetCpl === undefined ||
      body.breakevenCpl === undefined ||
      body.breakevenCpl > body.targetCpl,
    {
      message: "breakevenCpl harus lebih besar dari targetCpl",
      path: ["breakevenCpl"],
    },
  );
export type UpdateBusinessContextBodyDto = z.infer<typeof UpdateBusinessContextBodySchema>;

/** `GET /api/v1/property-objective/budget-suggestion` query — Finding 4's real budget calculator. */
export const BudgetSuggestionQuerySchema = z.object({
  targetHotLeads: z.coerce.number().positive(),
});

export type BudgetSuggestionQueryDto = z.infer<typeof BudgetSuggestionQuerySchema>;

/**
 * `GET /api/v1/property-objective/budget-suggestion` response — honest-unavailable shape, same
 * "never a fabricated default number" discipline `OverviewService.safeFetch`/`AiJudgeService`'s
 * honest-undefined-on-empty-sample pattern already establish elsewhere in this app. `available:
 * false` is a real, first-class outcome (a brand-new tenant with zero computable CPL values), never
 * an error thrown for that case.
 */
export type BudgetSuggestionResponseDto =
  | {
      readonly available: true;
      readonly suggestedBudget: number;
      readonly portfolioAvgCplIDR: number;
      readonly targetHotLeads: number;
    }
  | {
      readonly available: false;
      readonly reason: string;
    };

/** COLUMN-FOR-COLUMN projection of a `property_objectives` row (mirrors `ObjectiveResponseDto`'s flattening convention, `objective-response.dto.ts`). */
export interface PropertyObjectiveResponseDto {
  readonly id: string;
  readonly tenantId: string;
  readonly period: { readonly month: number; readonly year: number };
  readonly targetHotLeads: number;
  readonly budgetAllocation: number;
  readonly budgetSource: string;
  readonly focusListings: readonly string[];
  readonly areaPriorities: readonly string[];
  readonly status: string;
  readonly createdAt: string;
  readonly activatedAt?: string;
  readonly completedAt?: string;
  /**
   * AAOS LOOP UPGRADE, Sprint 6 Prompt 15 — real business context, `undefined` for every field the
   * tenant has not filled in yet (never a fabricated 0). See `043_property_objectives_business_context.sql`'s
   * own doc.
   */
  readonly avgDealValue?: number;
  readonly targetCpl?: number;
  readonly breakevenCpl?: number;
  readonly businessContextUpdatedBy?: string;
  readonly businessContextUpdatedAt?: string;
}

/** Raw `property_objectives` row shape (snake_case) — COLUMN-FOR-COLUMN with `supabase/migrations/032_property_objectives.sql` + `043_property_objectives_business_context.sql`. */
export interface PropertyObjectiveRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly period_month: number;
  readonly period_year: number;
  readonly target_hot_leads: number;
  readonly budget_allocation: number;
  readonly budget_source: string;
  readonly focus_listings: readonly string[];
  readonly area_priorities: readonly string[];
  readonly status: string;
  readonly created_at: string;
  readonly activated_at: string | null;
  readonly completed_at: string | null;
  readonly avg_deal_value: number | null;
  readonly target_cpl: number | null;
  readonly breakeven_cpl: number | null;
  readonly updated_by: string | null;
  readonly updated_at: string | null;
}

export function toPropertyObjectiveResponseDto(
  row: PropertyObjectiveRow,
): PropertyObjectiveResponseDto {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    period: { month: row.period_month, year: row.period_year },
    targetHotLeads: row.target_hot_leads,
    budgetAllocation: row.budget_allocation,
    budgetSource: row.budget_source,
    focusListings: row.focus_listings,
    areaPriorities: row.area_priorities,
    status: row.status,
    createdAt: row.created_at,
    ...(row.activated_at !== null ? { activatedAt: row.activated_at } : {}),
    ...(row.completed_at !== null ? { completedAt: row.completed_at } : {}),
    ...(row.avg_deal_value !== null ? { avgDealValue: row.avg_deal_value } : {}),
    ...(row.target_cpl !== null ? { targetCpl: row.target_cpl } : {}),
    ...(row.breakeven_cpl !== null ? { breakevenCpl: row.breakeven_cpl } : {}),
    ...(row.updated_by !== null ? { businessContextUpdatedBy: row.updated_by } : {}),
    ...(row.updated_at !== null ? { businessContextUpdatedAt: row.updated_at } : {}),
  };
}

/**
 * A tenant's business context counts as "filled in" (per the spec's own fallback rule: "Kalau
 * business context belum diisi (semua 0/kosong)...") only when ALL 3 real numbers are present —
 * treating a partially-filled context as "filled" would let `buildCplReasoningText` silently cite a
 * `breakevenCpl` while `targetCpl` is still generic-threshold, an inconsistent reasoning sentence.
 * `0` is deliberately treated the SAME as "not filled in" (never a legitimate real target/breakeven
 * CPL or AOV) — matches this DTO's own `.nonnegative()` Zod boundary, which allows `0` as a
 * technically valid write but this predicate still honestly reports it as "not real business
 * context yet".
 */
export function isBusinessContextFilled(
  objective: Pick<PropertyObjectiveResponseDto, "avgDealValue" | "targetCpl" | "breakevenCpl">,
): boolean {
  return (
    objective.avgDealValue !== undefined &&
    objective.avgDealValue > 0 &&
    objective.targetCpl !== undefined &&
    objective.targetCpl > 0 &&
    objective.breakevenCpl !== undefined &&
    objective.breakevenCpl > 0
  );
}
