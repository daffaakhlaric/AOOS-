import type { SupabaseClientLike } from "@aos/lead-store";

const TABLE = "agent_logic";

/**
 * Raw `agent_logic` row shape (snake_case) — COLUMN-FOR-COLUMN with
 * `supabase/migrations/035_agent_logic.sql`. Any future column MUST be added in both files in the
 * same change (same discipline `AgentConfigRow` documents on itself, one table over).
 */
export interface AgentLogicRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly agent: string;
  readonly logic_key: string;
  /** Untyped JSONB — `AgentLogicService.get` is the real, honest validation boundary (see that class's own doc), same "DB just stores it, the service validates" convention `AgentConfigRow.value` documents on itself. */
  readonly definition: unknown;
  readonly version: number;
  readonly score: number | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly updated_by: string | null;
}

export class AgentLogicRepositoryError extends Error {}

export interface UpsertAgentLogicInput {
  readonly tenantId: string;
  readonly agent: string;
  readonly logicKey: string;
  readonly definition: unknown;
  readonly updatedAt: string;
  readonly updatedBy?: string;
}

/**
 * Supabase-backed persistence for `agent_logic` (AAOS Self-Improving, Phase SI-2) — the
 * `LOGIC_UPDATE` sibling of Phase SI-1's real `agent_configs`/`AgentConfigRepository`, which this
 * class mirrors shape-for-shape (same real read-then-insert-or-update `upsert`, for the exact same
 * "the shared `SupabaseClientLike` port has no native `.upsert()`" reason `AgentConfigRepository`
 * documents on itself — see that class's own doc).
 */
export class AgentLogicRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  /** The real logic row for `(tenantId, agent, logicKey)`, if one exists — `undefined` (never thrown) when no row matches. */
  async findByKey(
    tenantId: string,
    agent: string,
    logicKey: string,
  ): Promise<AgentLogicRow | undefined> {
    const { data, error } = await this.client
      .from<AgentLogicRow>(TABLE)
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("agent", agent)
      .eq("logic_key", logicKey)
      .maybeSingle();
    if (error !== null) {
      throw new AgentLogicRepositoryError(
        `AgentLogicRepository.findByKey failed: ${error.message}`,
      );
    }
    return data ?? undefined;
  }

  /**
   * Real insert-or-update for `(tenantId, agent, logicKey)` — the ONLY real write path this table
   * gets (`AgentLogicService.set`'s real caller, itself called by a human editor action or
   * `LogicApplierService.applyLogicUpdate`'s real auto-apply write). `version` is a real, simple
   * increment-on-write counter (1 on first insert, `existing.version + 1` on every update) — a
   * real, honest audit signal for a future Logic editor UI, never parsed/branched on by this class
   * itself.
   */
  async upsert(input: UpsertAgentLogicInput): Promise<AgentLogicRow> {
    const existing = await this.findByKey(input.tenantId, input.agent, input.logicKey);
    const values = {
      tenant_id: input.tenantId,
      agent: input.agent,
      logic_key: input.logicKey,
      definition: input.definition,
      version: existing === undefined ? 1 : existing.version + 1,
      updated_at: input.updatedAt,
      updated_by: input.updatedBy ?? null,
    };
    if (existing === undefined) {
      const { data, error } = await this.client
        .from<AgentLogicRow>(TABLE)
        .insert(values)
        .select("*")
        .single();
      if (error !== null || data === null) {
        throw new AgentLogicRepositoryError(
          `AgentLogicRepository.upsert (insert) failed: ${error?.message ?? "no row returned"}`,
        );
      }
      return data;
    }
    const { data, error } = await this.client
      .from<AgentLogicRow>(TABLE)
      .update(values)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error !== null || data === null) {
      throw new AgentLogicRepositoryError(
        `AgentLogicRepository.upsert (update) failed: ${error?.message ?? "no row returned"}`,
      );
    }
    return data;
  }
}
