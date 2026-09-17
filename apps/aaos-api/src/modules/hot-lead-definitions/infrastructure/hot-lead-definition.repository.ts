import type { SupabaseClientLike } from "@aos/lead-store";

const TABLE = "hot_lead_definitions";

/** Raw `hot_lead_definitions` row shape (snake_case) — COLUMN-FOR-COLUMN with `supabase/migrations/054_growth_objectives.sql`. */
export interface HotLeadDefinitionRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly mode: string;
  readonly lead_status_value: string | null;
  readonly rules: unknown;
  readonly created_at: string;
  readonly updated_at: string;
}

export class HotLeadDefinitionRepositoryError extends Error {}

export interface UpsertHotLeadDefinitionInput {
  readonly tenantId: string;
  readonly mode: string;
  readonly leadStatusValue: string | null;
  readonly rules: unknown;
  readonly updatedAt: string;
}

/**
 * Supabase-backed persistence for `hot_lead_definitions` — one row per tenant (`tenant_id UNIQUE`).
 * `upsert` is a real read-then-insert-or-update, NOT a native `.upsert()` — same real constraint
 * `AgentConfigRepository.upsert`'s own docstring documents (the shared `SupabaseClientLike` port,
 * `@aos/lead-store`'s `SupabaseTypes.ts`, declares only `select`/`insert`/`update` for most
 * callers). One extra round-trip per write is irrelevant here: a tenant writes this at most a
 * handful of times ever, read far more often.
 */
export class HotLeadDefinitionRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  /** The tenant's stored definition, if one exists — `undefined` (never thrown, never fabricated) when the tenant hasn't defined one yet. */
  async findByTenant(tenantId: string): Promise<HotLeadDefinitionRow | undefined> {
    const { data, error } = await this.client
      .from<HotLeadDefinitionRow>(TABLE)
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (error !== null) {
      throw new HotLeadDefinitionRepositoryError(
        `HotLeadDefinitionRepository.findByTenant failed: ${error.message}`,
      );
    }
    return data ?? undefined;
  }

  async upsert(input: UpsertHotLeadDefinitionInput): Promise<HotLeadDefinitionRow> {
    const existing = await this.findByTenant(input.tenantId);
    const values = {
      tenant_id: input.tenantId,
      mode: input.mode,
      lead_status_value: input.leadStatusValue,
      rules: input.rules,
      updated_at: input.updatedAt,
    };
    if (existing === undefined) {
      const { data, error } = await this.client
        .from<HotLeadDefinitionRow>(TABLE)
        .insert(values)
        .select("*")
        .single();
      if (error !== null || data === null) {
        throw new HotLeadDefinitionRepositoryError(
          `HotLeadDefinitionRepository.upsert (insert) failed: ${error?.message ?? "no row returned"}`,
        );
      }
      return data;
    }
    const { data, error } = await this.client
      .from<HotLeadDefinitionRow>(TABLE)
      .update(values)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error !== null || data === null) {
      throw new HotLeadDefinitionRepositoryError(
        `HotLeadDefinitionRepository.upsert (update) failed: ${error?.message ?? "no row returned"}`,
      );
    }
    return data;
  }
}
