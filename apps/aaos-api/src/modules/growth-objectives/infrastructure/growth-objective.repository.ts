import type { SupabaseClientLike } from "@aos/lead-store";

const TABLE = "growth_objectives";

/** Raw `growth_objectives` row shape (snake_case) — COLUMN-FOR-COLUMN with `supabase/migrations/054_growth_objectives.sql`. */
export interface GrowthObjectiveRow {
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
  /** `055_growth_objective_forecast.sql` — the real `{reverseFunnel, feasibility}` object `GrowthObjectivesService.analyze` computes. `null` until `/analyze` has been called at least once for this objective. */
  readonly forecast: unknown | null;
  /** `055_growth_objective_forecast.sql` — when `forecast` was actually computed. `null` until the first `/analyze` call. */
  readonly forecast_computed_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

/** `forecast`/`forecast_computed_at` are never set on create (every new objective starts `DRAFT` with no forecast yet — the DB column defaults both to `NULL`) — only `GrowthObjectivesService.analyze`'s `update()` call ever writes them. */
export type GrowthObjectiveInsert = Omit<
  GrowthObjectiveRow,
  "id" | "created_at" | "updated_at" | "forecast" | "forecast_computed_at"
>;
export type GrowthObjectiveUpdate = Partial<
  Omit<GrowthObjectiveRow, "id" | "tenant_id" | "created_at">
>;

export class GrowthObjectiveRepositoryError extends Error {}

/**
 * Supabase-backed persistence for `growth_objectives` (EYVRA — SAMANTHA V2, Phase 1 Part A). Every
 * read/write is explicitly tenant-scoped via `.eq("tenant_id", tenantId)` — same discipline
 * `ListingRepository` already establishes for this app's genuinely-new-from-Phase-1-onward
 * modules, never relying on a column default.
 */
export class GrowthObjectiveRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  async create(values: GrowthObjectiveInsert): Promise<GrowthObjectiveRow> {
    const { data, error } = await this.client
      .from<GrowthObjectiveRow>(TABLE)
      .insert(values)
      .select("*")
      .single();
    if (error !== null || data === null) {
      throw new GrowthObjectiveRepositoryError(
        `GrowthObjectiveRepository.create failed: ${error?.message ?? "no row returned"}`,
      );
    }
    return data;
  }

  async findById(tenantId: string, id: string): Promise<GrowthObjectiveRow | undefined> {
    const { data, error } = await this.client
      .from<GrowthObjectiveRow>(TABLE)
      .select("*")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (error !== null) {
      throw new GrowthObjectiveRepositoryError(
        `GrowthObjectiveRepository.findById failed: ${error.message}`,
      );
    }
    return data ?? undefined;
  }

  async list(tenantId: string): Promise<readonly GrowthObjectiveRow[]> {
    const { data, error } = await this.client
      .from<GrowthObjectiveRow>(TABLE)
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    if (error !== null) {
      throw new GrowthObjectiveRepositoryError(
        `GrowthObjectiveRepository.list failed: ${error.message}`,
      );
    }
    return data ?? [];
  }

  async update(
    tenantId: string,
    id: string,
    values: GrowthObjectiveUpdate,
  ): Promise<GrowthObjectiveRow> {
    const { data, error } = await this.client
      .from<GrowthObjectiveRow>(TABLE)
      .update(values)
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .select("*")
      .single();
    if (error !== null || data === null) {
      throw new GrowthObjectiveRepositoryError(
        `GrowthObjectiveRepository.update failed: ${error?.message ?? "no row returned"}`,
      );
    }
    return data;
  }
}
