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
  /** AAOS LOOP UPGRADE, Sprint 6 Prompt 15 — real business context, `undefined` for every field not filled in yet (never a fabricated 0). */
  readonly avgDealValue?: number;
  readonly targetCpl?: number;
  readonly breakevenCpl?: number;
  readonly businessContextUpdatedBy?: string;
  readonly businessContextUpdatedAt?: string;
  /**
   * AAOS LOOP UPGRADE, Sprint 8a — real, per-tenant NEED_CREATIVE auto-brief guardrail settings
   * (mirrors `aaos-api`'s `PropertyObjectiveResponseDto` exactly — SAMANTHA ADVANCED SPRINT 3
   * investigation found these were already sent on the wire by `GET/POST /api/property-objective`
   * but missing from this frontend type; added here rather than fetched a second way). Always
   * present (both real DB columns are `NOT NULL DEFAULT`, never nullable).
   */
  readonly maxAutoBriefsPerDay: number;
  readonly autoApproveCreativeBrief: boolean;
  /**
   * AAOS LOOP UPGRADE, Sprint 8c — real, per-tenant campaign-publish guardrail settings. Always
   * present (both real DB columns are `NOT NULL DEFAULT`, never nullable) — `autoPublishCampaign`
   * defaults to `false` (the real, user-confirmed safety default), `maxBudgetIncreasePct` to `20`.
   */
  readonly autoPublishCampaign: boolean;
  readonly maxBudgetIncreasePct: number;
}

/** `PATCH /api/property-objective/business-context` body — mirrors `UpdateBusinessContextBodyDto`. */
export interface UpdateBusinessContextInput {
  readonly avgDealValue?: number;
  readonly targetCpl?: number;
  readonly breakevenCpl?: number;
}

/** `PATCH /api/property-objective/auto-publish-settings` body — mirrors `UpdateAutoPublishSettingsBodyDto` (AAOS LOOP UPGRADE, Sprint 8c). */
export interface UpdateAutoPublishSettingsInput {
  readonly autoPublishCampaign?: boolean;
  readonly maxBudgetIncreasePct?: number;
}

/** Real, honest check mirroring `apps/aaos-api`'s `isBusinessContextFilled` exactly — used by the dashboard to decide whether to show the "belum diisi" banner. */
export function isBusinessContextFilled(
  objective: Pick<PropertyObjectiveDto, "avgDealValue" | "targetCpl" | "breakevenCpl"> | undefined,
): boolean {
  return (
    objective !== undefined &&
    objective.avgDealValue !== undefined &&
    objective.avgDealValue > 0 &&
    objective.targetCpl !== undefined &&
    objective.targetCpl > 0 &&
    objective.breakevenCpl !== undefined &&
    objective.breakevenCpl > 0
  );
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
