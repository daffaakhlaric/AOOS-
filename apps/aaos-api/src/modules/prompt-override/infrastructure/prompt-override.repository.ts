import type { SupabaseClientLike } from "@aos/lead-store";

const TABLE = "agent_prompt_overrides";

/**
 * Raw `agent_prompt_overrides` row shape (snake_case) — COLUMN-FOR-COLUMN with
 * `supabase/migrations/022_agent_prompt_overrides.sql`. Any future column MUST be added in both
 * files in the same change (same discipline `TenantRow`/`MetaInterestRow` document on themselves).
 */
export interface PromptOverrideRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly agent: string;
  readonly prompt_key: string;
  readonly content: string;
  readonly version: number;
  readonly is_active: boolean;
  readonly created_at: string;
  readonly activated_at: string | null;
  readonly deactivated_at: string | null;
}

export class PromptOverrideRepositoryError extends Error {}

/**
 * Supabase-backed persistence for `agent_prompt_overrides` (AAOS Self-Learning AI, Phase A). Built
 * on the same shared `SupabaseClientLike` port + `SUPABASE_CLIENT` DI token every other `aaos-api`
 * repository uses (see `MetaInterestRepository`/`TenantRepository` for the precedent this mirrors)
 * — one Supabase client for the whole app, not a second connection.
 *
 * Read-only in Phase A: nothing in this pass ever writes an override row. Phase C (a later,
 * separate effort — the dashboard Learning Monitor's Approve action) is the only real writer, per
 * `docs/PROMPT-AAOS-SELF-LEARNING-AI.md`'s own design — so no `insert`/`activate`/`deactivate`
 * method is added here speculatively.
 */
export class PromptOverrideRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  /**
   * The active override row for `(tenantId, agent, promptKey)`, if one exists. `.maybeSingle()`
   * assumes at most one `is_active = true` row per key — a service-layer invariant this table's
   * own writer (Phase C) is responsible for upholding, same "Zod/service validates, DB just stores
   * it" convention `tenants.mode` documents on itself (no partial unique index enforcing it here,
   * mirroring that same documented choice).
   */
  async findActive(
    tenantId: string,
    agent: string,
    promptKey: string,
  ): Promise<PromptOverrideRow | undefined> {
    const { data, error } = await this.client
      .from<PromptOverrideRow>(TABLE)
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("agent", agent)
      .eq("prompt_key", promptKey)
      .eq("is_active", true)
      .maybeSingle();
    if (error !== null) {
      throw new PromptOverrideRepositoryError(
        `PromptOverrideRepository.findActive failed: ${error.message}`,
      );
    }
    return data ?? undefined;
  }
}
