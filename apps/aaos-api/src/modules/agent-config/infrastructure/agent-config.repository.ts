import type { SupabaseClientLike } from "@aos/lead-store";

const TABLE = "agent_configs";

/**
 * Raw `agent_configs` row shape (snake_case) — COLUMN-FOR-COLUMN with
 * `supabase/migrations/034_agent_configs.sql`. Any future column MUST be added in both files in
 * the same change (same discipline `PromptOverrideRow`/`TenantRow` document on themselves).
 */
export interface AgentConfigRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly agent: string;
  readonly config_key: string;
  readonly value: string;
  readonly data_type: string;
  readonly description: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly updated_by: string | null;
}

export class AgentConfigRepositoryError extends Error {}

export interface UpsertAgentConfigInput {
  readonly tenantId: string;
  readonly agent: string;
  readonly configKey: string;
  readonly value: string;
  readonly dataType: string;
  readonly updatedAt: string;
  readonly updatedBy?: string;
}

/**
 * Supabase-backed persistence for `agent_configs` (AAOS Self-Improving, Phase SI-1 — the
 * `CONFIG_UPDATE` sibling of Phase A's real `agent_prompt_overrides`/`PromptOverrideRepository`,
 * which this class mirrors shape-for-shape). Built on the same shared `SupabaseClientLike` port +
 * `SUPABASE_CLIENT` DI token every other `aaos-api` repository uses — one Supabase client for the
 * whole app, not a second connection.
 *
 * WHY `upsert` IS A REAL READ-THEN-INSERT-OR-UPDATE, NOT A NATIVE `.upsert()`: the shared
 * `SupabaseClientLike` port (`@aos/lead-store`'s `SupabaseTypes.ts`) declares only
 * `select`/`insert`/`update` for most callers — same real constraint `MetaInterestRepository.save`/
 * `RecyclingSettingsRepository.setAutoMode` already document on themselves, and the same pattern
 * this class mirrors directly. One extra round-trip per write is irrelevant at this table's real
 * volume (a handful of config rows per tenant, written far less often than read).
 */
export class AgentConfigRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  /** The real config row for `(tenantId, agent, configKey)`, if one exists — `undefined` (never thrown) when no row matches. */
  async findByKey(
    tenantId: string,
    agent: string,
    configKey: string,
  ): Promise<AgentConfigRow | undefined> {
    const { data, error } = await this.client
      .from<AgentConfigRow>(TABLE)
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("agent", agent)
      .eq("config_key", configKey)
      .maybeSingle();
    if (error !== null) {
      throw new AgentConfigRepositoryError(
        `AgentConfigRepository.findByKey failed: ${error.message}`,
      );
    }
    return data ?? undefined;
  }

  /**
   * Real insert-or-update for `(tenantId, agent, configKey)` — the ONLY real write path this table
   * gets (`AgentConfigService.set`'s real caller, itself called by a human Config editor action or
   * `ConfigApplierService.applyConfigUpdate`'s real auto-apply write). See this class's own doc for
   * why this is read-then-write rather than a native `.upsert()`.
   */
  async upsert(input: UpsertAgentConfigInput): Promise<AgentConfigRow> {
    const existing = await this.findByKey(input.tenantId, input.agent, input.configKey);
    const values = {
      tenant_id: input.tenantId,
      agent: input.agent,
      config_key: input.configKey,
      value: input.value,
      data_type: input.dataType,
      updated_at: input.updatedAt,
      updated_by: input.updatedBy ?? null,
    };
    if (existing === undefined) {
      const { data, error } = await this.client
        .from<AgentConfigRow>(TABLE)
        .insert(values)
        .select("*")
        .single();
      if (error !== null || data === null) {
        throw new AgentConfigRepositoryError(
          `AgentConfigRepository.upsert (insert) failed: ${error?.message ?? "no row returned"}`,
        );
      }
      return data;
    }
    const { data, error } = await this.client
      .from<AgentConfigRow>(TABLE)
      .update(values)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error !== null || data === null) {
      throw new AgentConfigRepositoryError(
        `AgentConfigRepository.upsert (update) failed: ${error?.message ?? "no row returned"}`,
      );
    }
    return data;
  }
}
