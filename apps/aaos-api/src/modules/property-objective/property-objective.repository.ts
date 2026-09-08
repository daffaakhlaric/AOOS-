import type { SupabaseClientLike } from "@aos/lead-store";

import type { PropertyObjectiveRow } from "./dto/property-objective.dto.js";

const TABLE = "property_objectives";

export interface CreatePropertyObjectiveInput {
  readonly tenantId: string;
  readonly periodMonth: number;
  readonly periodYear: number;
  readonly targetHotLeads: number;
  readonly budgetAllocation: number;
  readonly budgetSource: string;
  readonly focusListings: readonly string[];
  readonly areaPriorities: readonly string[];
}

export class PropertyObjectiveRepositoryError extends Error {}

/**
 * Supabase-backed persistence for `property_objectives` (Phase O1). Built on the same shared
 * `SupabaseClientLike` port + `SUPABASE_CLIENT` DI token every other `aaos-api` repository uses —
 * mirrors `ListingRepository`/`PendingActionRepository` column-for-column (`create` always inserts
 * `status: 'DRAFT'`, real error-throwing convention on a non-null Supabase `error`).
 */
export class PropertyObjectiveRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  async create(input: CreatePropertyObjectiveInput): Promise<PropertyObjectiveRow> {
    const { data, error } = await this.client
      .from<PropertyObjectiveRow>(TABLE)
      .insert({
        tenant_id: input.tenantId,
        period_month: input.periodMonth,
        period_year: input.periodYear,
        target_hot_leads: input.targetHotLeads,
        budget_allocation: input.budgetAllocation,
        budget_source: input.budgetSource,
        focus_listings: input.focusListings,
        area_priorities: input.areaPriorities,
        status: "DRAFT",
        // AAOS LOOP UPGRADE, Sprint 8a — written explicitly (not left to the DB column default)
        // matching this method's own established convention (`status: "DRAFT"` above) so a real
        // row this call `SELECT`s back always carries them, including in the fake in-memory test
        // client which does not simulate DB column defaults on `.insert()`. `false` for
        // `auto_approve_creative_brief` is the load-bearing safety default this dispatch's own
        // requirement demands — never `true`.
        max_auto_briefs_per_day: 5,
        auto_approve_creative_brief: false,
        // AAOS LOOP UPGRADE, Sprint 8c — same explicit-write convention as the 2 columns above
        // (not left to the DB column default, for the exact same real-in-memory-test-client
        // reason). `false` for `auto_publish_campaign` is the load-bearing, user-confirmed safety
        // default this dispatch's own requirement demands — never `true`. `20` for
        // `max_budget_increase_pct` matches the real DB column default (`048_campaign_auto_publish
        // .sql`) and the spec's own literal suggested value.
        auto_publish_campaign: false,
        max_budget_increase_pct: 20,
      })
      .select("*")
      .single();
    if (error !== null || data === null) {
      throw new PropertyObjectiveRepositoryError(
        `PropertyObjectiveRepository.create failed: ${error?.message ?? "no row returned"}`,
      );
    }
    return data;
  }

  /** Every stored objective for a tenant, regardless of status — used by `PropertyObjectiveService`'s "max 1 active/draft objective per tenant per period" check, same real purpose `IObjectiveRepository.listByTenant` serves for `CreateObjective.countActiveForPeriod`. */
  async listByTenant(tenantId: string): Promise<readonly PropertyObjectiveRow[]> {
    const { data, error } = await this.client
      .from<PropertyObjectiveRow>(TABLE)
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    if (error !== null) {
      throw new PropertyObjectiveRepositoryError(
        `PropertyObjectiveRepository.listByTenant failed: ${error.message}`,
      );
    }
    return data ?? [];
  }

  /** AAOS LOOP UPGRADE, Sprint 6 Prompt 15 — the real Business Context write. `id` is the objective row being edited (the tenant's real "current" one, resolved by `PropertyObjectiveService.updateBusinessContext`), never a fabricated/implicit target. */
  async updateBusinessContext(
    id: string,
    input: {
      readonly avgDealValue?: number;
      readonly targetCpl?: number;
      readonly breakevenCpl?: number;
      readonly updatedBy?: string;
      readonly updatedAt: string;
    },
  ): Promise<PropertyObjectiveRow> {
    const { data, error } = await this.client
      .from<PropertyObjectiveRow>(TABLE)
      .update({
        ...(input.avgDealValue !== undefined ? { avg_deal_value: input.avgDealValue } : {}),
        ...(input.targetCpl !== undefined ? { target_cpl: input.targetCpl } : {}),
        ...(input.breakevenCpl !== undefined ? { breakeven_cpl: input.breakevenCpl } : {}),
        updated_by: input.updatedBy ?? null,
        updated_at: input.updatedAt,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error !== null || data === null) {
      throw new PropertyObjectiveRepositoryError(
        `PropertyObjectiveRepository.updateBusinessContext failed: ${error?.message ?? "no row returned"}`,
      );
    }
    return data;
  }

  /** AAOS LOOP UPGRADE, Sprint 8a — the real NEED_CREATIVE auto-brief guardrail settings write, mirrors `updateBusinessContext`'s exact shape (partial update, `id` = the tenant's real current-period objective row). */
  async updateAutoLoopSettings(
    id: string,
    input: {
      readonly maxAutoBriefsPerDay?: number;
      readonly autoApproveCreativeBrief?: boolean;
    },
  ): Promise<PropertyObjectiveRow> {
    const { data, error } = await this.client
      .from<PropertyObjectiveRow>(TABLE)
      .update({
        ...(input.maxAutoBriefsPerDay !== undefined
          ? { max_auto_briefs_per_day: input.maxAutoBriefsPerDay }
          : {}),
        ...(input.autoApproveCreativeBrief !== undefined
          ? { auto_approve_creative_brief: input.autoApproveCreativeBrief }
          : {}),
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error !== null || data === null) {
      throw new PropertyObjectiveRepositoryError(
        `PropertyObjectiveRepository.updateAutoLoopSettings failed: ${error?.message ?? "no row returned"}`,
      );
    }
    return data;
  }

  /** AAOS LOOP UPGRADE, Sprint 8c — the real campaign-publish guardrail settings write, mirrors `updateAutoLoopSettings`'s exact shape (partial update, `id` = the tenant's real current-period objective row). */
  async updateAutoPublishSettings(
    id: string,
    input: {
      readonly autoPublishCampaign?: boolean;
      readonly maxBudgetIncreasePct?: number;
    },
  ): Promise<PropertyObjectiveRow> {
    const { data, error } = await this.client
      .from<PropertyObjectiveRow>(TABLE)
      .update({
        ...(input.autoPublishCampaign !== undefined
          ? { auto_publish_campaign: input.autoPublishCampaign }
          : {}),
        ...(input.maxBudgetIncreasePct !== undefined
          ? { max_budget_increase_pct: input.maxBudgetIncreasePct }
          : {}),
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error !== null || data === null) {
      throw new PropertyObjectiveRepositoryError(
        `PropertyObjectiveRepository.updateAutoPublishSettings failed: ${error?.message ?? "no row returned"}`,
      );
    }
    return data;
  }
}
