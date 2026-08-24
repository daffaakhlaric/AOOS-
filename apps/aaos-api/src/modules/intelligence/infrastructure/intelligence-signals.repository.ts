import type { SupabaseClientLike } from "@aos/lead-store";

const TABLE = "intelligence_signals";

/** Raw `intelligence_signals` row shape (snake_case) — COLUMN-FOR-COLUMN with `supabase/migrations/016_intelligence.sql`. */
export interface IntelligenceSignalsRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly branch_id: string | null;
  readonly seasonal_data: unknown;
  readonly trends_data: unknown;
  readonly competitor_data: unknown;
  readonly inventory_data: unknown;
  readonly lead_profile_data: unknown;
  readonly closing_data: unknown;
  /** AAOS-META-MCP-BONUS-TOOLS (Tool 4) — `IntelligenceService.buildCapiHealthContext`'s real, or honestly-unavailable, result. Nullable: rows written before this column existed have `null` here. */
  readonly capi_health_data: unknown;
  /** AAOS-META-MCP-BONUS-TOOLS (Tool 1) — `IntelligenceService.buildAnomalyContext`'s real, or honestly-unavailable, result. Nullable: rows written before this column existed have `null` here. */
  readonly anomaly_data: unknown;
  readonly campaign_strategy: unknown;
  readonly digest_text: string | null;
  readonly generated_at: string;
}

export type IntelligenceSignalsInsert = Omit<IntelligenceSignalsRow, "id" | "generated_at">;

export class IntelligenceSignalsRepositoryError extends Error {}

/**
 * Supabase-backed persistence for `intelligence_signals` (AAOS-TAMARA-INTELLIGENCE-LAYER Phase 4).
 * Same shared `SupabaseClientLike` port + `SUPABASE_CLIENT` DI token every other `aaos-api`
 * repository uses — mirrors `BroadcastTemplateRepository`/`ListingRepository`'s structure directly.
 */
export class IntelligenceSignalsRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  async insert(values: IntelligenceSignalsInsert): Promise<IntelligenceSignalsRow> {
    const { data, error } = await this.client
      .from<IntelligenceSignalsRow>(TABLE)
      .insert({ ...values, generated_at: new Date().toISOString() })
      .select("*")
      .single();
    if (error !== null || data === null) {
      throw new IntelligenceSignalsRepositoryError(
        `IntelligenceSignalsRepository.insert failed: ${error?.message ?? "no row returned"}`,
      );
    }
    return data;
  }

  /** Most recently generated row for `tenantId`, or `undefined` when none exists yet — `GET /api/v1/intelligence/signals`'s real "latest" read. */
  async findLatestByTenant(tenantId: string): Promise<IntelligenceSignalsRow | undefined> {
    const { data, error } = await this.client
      .from<IntelligenceSignalsRow>(TABLE)
      .select("*")
      .eq("tenant_id", tenantId)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error !== null) {
      throw new IntelligenceSignalsRepositoryError(
        `IntelligenceSignalsRepository.findLatestByTenant failed: ${error.message}`,
      );
    }
    return data ?? undefined;
  }
}
