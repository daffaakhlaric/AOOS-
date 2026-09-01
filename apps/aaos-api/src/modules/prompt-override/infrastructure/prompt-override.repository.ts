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

export interface InsertPromptOverrideInput {
  readonly tenantId: string;
  readonly agent: string;
  readonly promptKey: string;
  readonly content: string;
  readonly version: number;
  readonly activatedAt: string;
}

/**
 * Supabase-backed persistence for `agent_prompt_overrides` (AAOS Self-Learning AI, Phase A;
 * extended in Phase C). Built on the same shared `SupabaseClientLike` port + `SUPABASE_CLIENT` DI
 * token every other `aaos-api` repository uses (see `MetaInterestRepository`/`TenantRepository`
 * for the precedent this mirrors) — one Supabase client for the whole app, not a second connection.
 *
 * Read-only in Phase A: nothing in that pass ever wrote an override row. Phase C's
 * `PromptOverrideService.applyApproved`/`.rollback` are now the ONLY real callers of `deactivate`/
 * `insert`/`reactivate` below — the dashboard Learning Monitor's Approve/Rollback actions, per
 * `docs/PROMPT-AAOS-SELF-LEARNING-AI.md`'s own design (this is the first, and by design ONLY,
 * write path anywhere in this codebase that activates an `agent_prompt_overrides` row).
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

  /** Every version (active or not) for `(tenantId, agent, promptKey)` — `PromptOverrideService.applyApproved`'s real source for computing the next version number, and `.rollback`'s real source for finding the previous one. */
  async listVersions(
    tenantId: string,
    agent: string,
    promptKey: string,
  ): Promise<readonly PromptOverrideRow[]> {
    const { data, error } = await this.client
      .from<PromptOverrideRow>(TABLE)
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("agent", agent)
      .eq("prompt_key", promptKey);
    if (error !== null) {
      throw new PromptOverrideRepositoryError(
        `PromptOverrideRepository.listVersions failed: ${error.message}`,
      );
    }
    return data ?? [];
  }

  /** Every currently-active override row for a tenant (any agent/promptKey) — the Learning Monitor's real "what's live right now" table. */
  async listActiveForTenant(tenantId: string): Promise<readonly PromptOverrideRow[]> {
    const { data, error } = await this.client
      .from<PromptOverrideRow>(TABLE)
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("is_active", true);
    if (error !== null) {
      throw new PromptOverrideRepositoryError(
        `PromptOverrideRepository.listActiveForTenant failed: ${error.message}`,
      );
    }
    return data ?? [];
  }

  /** Deactivates one row by id — `void`, same "update returns void, caller re-reads if needed" convention `SimulationRepository`'s decision/status writers already establish. Never touches any other row. */
  async deactivate(id: string, deactivatedAt: string): Promise<void> {
    const { error } = await this.client
      .from<PromptOverrideRow>(TABLE)
      .update({ is_active: false, deactivated_at: deactivatedAt })
      .eq("id", id);
    if (error !== null) {
      throw new PromptOverrideRepositoryError(
        `PromptOverrideRepository.deactivate failed: ${error.message}`,
      );
    }
  }

  /** Reactivates a previously-deactivated row by id (real manual rollback, AAOS Self-Learning AI Phase C Finding #6) — sets `is_active = true`, clears `deactivated_at`, refreshes `activated_at`. Never inserts a new row/version. */
  async reactivate(id: string, activatedAt: string): Promise<void> {
    const { error } = await this.client
      .from<PromptOverrideRow>(TABLE)
      .update({ is_active: true, activated_at: activatedAt, deactivated_at: null })
      .eq("id", id);
    if (error !== null) {
      throw new PromptOverrideRepositoryError(
        `PromptOverrideRepository.reactivate failed: ${error.message}`,
      );
    }
  }

  /** Inserts a brand-new, already-active override row — the real second half of `PromptOverrideService.applyApproved`'s deactivate-then-insert sequence (see that method's doc for why insert only ever runs after the prior active row's deactivate has already succeeded). */
  async insert(input: InsertPromptOverrideInput): Promise<PromptOverrideRow> {
    const { data, error } = await this.client
      .from<PromptOverrideRow>(TABLE)
      .insert({
        tenant_id: input.tenantId,
        agent: input.agent,
        prompt_key: input.promptKey,
        content: input.content,
        version: input.version,
        is_active: true,
        activated_at: input.activatedAt,
      })
      .select("*")
      .single();
    if (error !== null || data === null) {
      throw new PromptOverrideRepositoryError(
        `PromptOverrideRepository.insert failed: ${error?.message ?? "no row returned"}`,
      );
    }
    return data;
  }
}
