/**
 * Mirrors `apps/aaos-api`'s `modules/property-objective/dto/property-objective.dto.ts` EXACTLY —
 * the wire contract between this app's `/api/property-objective/*` route handlers and the real
 * backend (Phase O2, `docs/PROMPT-AAOS-TENANT-SCOPING-AND-PROPERTY-OBJECTIVE.md`). Deliberately a
 * separate file from `dashboard.types.ts`'s `ObjectiveDto` — the two shapes genuinely diverge
 * (`focusListings`/`areaPriorities`/`budgetSource` here vs. `focusUnits` there), same reasoning
 * `listing.types.ts` already documents for its own separate file.
 */

/** `POST /api/property-objective` body — mirrors `CreatePropertyObjectiveBodyDto` exactly. */
export interface CreatePropertyObjectiveInput {
  readonly targetHotLeads: number;
  readonly budgetAllocation: number;
  readonly budgetSource?: "MANUAL" | "SAMANTHA_SUGGESTED";
  readonly focusListings: readonly string[];
  readonly areaPriorities: readonly string[];
}

/** COLUMN-FOR-COLUMN mirror of `PropertyObjectiveResponseDto`. */
export interface PropertyObjectiveDto {
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

/** Mirrors `BudgetSuggestionResponseDto`'s real honest-unavailable union exactly. */
export type BudgetSuggestionDto =
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
