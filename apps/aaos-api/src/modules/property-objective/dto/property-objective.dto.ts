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
}

/** Raw `property_objectives` row shape (snake_case) — COLUMN-FOR-COLUMN with `supabase/migrations/032_property_objectives.sql`. */
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
  };
}
