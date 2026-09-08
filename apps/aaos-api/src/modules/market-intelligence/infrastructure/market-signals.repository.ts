import type { SupabaseClientLike } from "@aos/lead-store";

const TABLE = "market_signals";

/** Raw `market_signals` row shape (snake_case) — COLUMN-FOR-COLUMN with `supabase/migrations/046_market_signals.sql`. */
export interface MarketSignalsRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly vertical: string;
  readonly search_trend_data: unknown;
  readonly competitor_data: unknown;
  readonly kpr_rate_data: unknown;
  readonly seasonal_data: unknown;
  readonly digest_text: string | null;
  readonly generated_at: string;
}

export type MarketSignalsInsert = Omit<MarketSignalsRow, "id" | "generated_at">;

export class MarketSignalsRepositoryError extends Error {}

/**
 * Supabase-backed persistence for `market_signals` (AAOS LOOP UPGRADE, Sprint 7 Prompt 18). Same
 * shared `SupabaseClientLike` port + `SUPABASE_CLIENT` DI token every other `aaos-api` repository
 * uses — mirrors `IntelligenceSignalsRepository`'s own structure directly (genuinely separate
 * table, see `046_market_signals.sql`'s header doc for why).
 */
export class MarketSignalsRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  async insert(values: MarketSignalsInsert): Promise<MarketSignalsRow> {
    const { data, error } = await this.client
      .from<MarketSignalsRow>(TABLE)
      .insert({ ...values, generated_at: new Date().toISOString() })
      .select("*")
      .single();
    if (error !== null || data === null) {
      throw new MarketSignalsRepositoryError(
        `MarketSignalsRepository.insert failed: ${error?.message ?? "no row returned"}`,
      );
    }
    return data;
  }

  /** Most recently generated row for `tenantId`, or `undefined` when none exists yet — the "Sinyal Pasar" card's real "belum ada data" empty state. */
  async findLatestByTenant(tenantId: string): Promise<MarketSignalsRow | undefined> {
    const { data, error } = await this.client
      .from<MarketSignalsRow>(TABLE)
      .select("*")
      .eq("tenant_id", tenantId)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error !== null) {
      throw new MarketSignalsRepositoryError(
        `MarketSignalsRepository.findLatestByTenant failed: ${error.message}`,
      );
    }
    return data ?? undefined;
  }
}
