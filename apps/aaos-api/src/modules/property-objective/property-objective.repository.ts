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
}
