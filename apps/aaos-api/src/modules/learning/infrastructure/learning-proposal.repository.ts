import type { SupabaseClientLike } from "@aos/lead-store";

const TABLE = "learning_proposals";

/**
 * Raw `learning_proposals` row shape (snake_case) — COLUMN-FOR-COLUMN with
 * `supabase/migrations/024_learning_proposals.sql`. Any future column MUST be added in both files
 * in the same change (same discipline `PromptOverrideRow`/`TenantRow` document on themselves).
 */
export interface LearningProposalRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly simulation_id: string | null;
  /** AAOS-AI-JUDGE-SELF-IMPROVING, Phase J3 (`030_learning_proposals_agent_run_id.sql`) — the real LIVE-run trigger source, an alternative to `simulation_id`. Exactly one of the two is ever non-NULL per row — see that migration's own header doc and its `learning_proposals_exactly_one_trigger_source` CHECK constraint. */
  readonly agent_run_id: string | null;
  readonly agent: string;
  readonly analysis: string | null;
  readonly gaps: Record<string, unknown>;
  readonly improvements: readonly Record<string, unknown>[];
  readonly status: string;
  readonly decided_by: string | null;
  readonly decision_notes: string | null;
  readonly decided_at: string | null;
  readonly created_at: string;
  /**
   * AAOS Self-Improving, Phase SI-1 (`035_learning_proposals_auto_applied.sql`) — the real
   * `config_key` targets that were auto-applied (`ConfigApplierService.applyConfigUpdate`, no human
   * approval) for this proposal, if any. `[]` when this proposal has no `CONFIG_UPDATE` items or
   * none of them were successfully applied — see that migration's own header doc for the full
   * "why not just overload `status`" reasoning, and `LearningService.persistProposal`'s doc for the
   * real write sequencing.
   */
  readonly auto_applied_config_keys: readonly string[];
}

/**
 * `simulationId`/`agentRunId` are now both OPTIONAL, but exactly one MUST be supplied — `create()`
 * asserts this at the app layer (a real, early, honest error) as well as `030_learning_proposals_
 * agent_run_id.sql`'s own DB-level CHECK constraint enforcing the same real invariant (belt-and-
 * braces, same discipline `LlmService.generateImprovementPlan`'s `KNOWN_PROMPT_KEYS` re-validation
 * already establishes elsewhere in this effort).
 */
export interface CreateLearningProposalInput {
  readonly tenantId: string;
  readonly simulationId?: string;
  readonly agentRunId?: string;
  readonly agent: string;
  readonly analysis: string;
  readonly gaps: Record<string, unknown>;
  readonly improvements: readonly Record<string, unknown>[];
}

export class LearningProposalRepositoryError extends Error {}

/**
 * Supabase-backed persistence for `learning_proposals` (AAOS Self-Learning AI, Phase B; extended in
 * Phase C). Built on the same shared `SupabaseClientLike` port + `SUPABASE_CLIENT` DI token every
 * other `aaos-api` repository uses (see `PromptOverrideRepository`/`SimulationRepository` for the
 * precedent this mirrors) — one Supabase client for the whole app, not a second connection.
 *
 * `create` was the ONLY write Phase B ever performed, always inserting `status: 'PENDING'` with
 * every decision column left unset. `updateDecision` is Phase C's real Approve/Reject writer,
 * added now that a human-approval gate (`LearningDecisionService`) exists to call it — see this
 * table's own migration header doc for why `decided_by`/`decision_notes`/`decided_at` existed as
 * real columns before this phase, ready for exactly this write.
 */
export class LearningProposalRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  async create(input: CreateLearningProposalInput): Promise<LearningProposalRow> {
    const hasSimulation = input.simulationId !== undefined;
    const hasAgentRun = input.agentRunId !== undefined;
    if (hasSimulation === hasAgentRun) {
      // Mirrors `030_learning_proposals_agent_run_id.sql`'s own real DB CHECK constraint — caught
      // here first so a bug produces an immediate, clear app-level error instead of a raw
      // Postgres constraint-violation message.
      throw new LearningProposalRepositoryError(
        "LearningProposalRepository.create requires EXACTLY ONE of simulationId/agentRunId.",
      );
    }
    const { data, error } = await this.client
      .from<LearningProposalRow>(TABLE)
      .insert({
        tenant_id: input.tenantId,
        simulation_id: input.simulationId ?? null,
        agent_run_id: input.agentRunId ?? null,
        agent: input.agent,
        analysis: input.analysis,
        gaps: input.gaps,
        improvements: input.improvements,
        status: "PENDING",
      })
      .select("*")
      .single();
    if (error !== null || data === null) {
      throw new LearningProposalRepositoryError(
        `LearningProposalRepository.create failed: ${error?.message ?? "no row returned"}`,
      );
    }
    return data;
  }

  /**
   * The tenant's most recent `learning_proposals` rows (any agent, any status), oldest-first —
   * real context `LlmService.generateImprovementPlan` is fed so it doesn't re-propose something
   * already tried (mirrors the design doc's own "riwayat improvement sebelumnya (3 terakhir)"
   * framing, but with REAL data, capped at a real, sensible `limit`).
   */
  async listRecentForTenant(tenantId: string, limit = 3): Promise<readonly LearningProposalRow[]> {
    const { data, error } = await this.client
      .from<LearningProposalRow>(TABLE)
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error !== null) {
      throw new LearningProposalRepositoryError(
        `LearningProposalRepository.listRecentForTenant failed: ${error.message}`,
      );
    }
    return [...(data ?? [])].reverse();
  }

  /** A single proposal row by id, or `undefined` when none exists — `LearningDecisionService.getProposal`'s real lookup for every `:id`-scoped route (get/approve/reject). */
  async findById(id: string): Promise<LearningProposalRow | undefined> {
    const { data, error } = await this.client
      .from<LearningProposalRow>(TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error !== null) {
      throw new LearningProposalRepositoryError(
        `LearningProposalRepository.findById failed: ${error.message}`,
      );
    }
    return data ?? undefined;
  }

  /** The tenant's proposal rows, newest-first, optionally filtered by real `status` — the Learning Monitor's real list source (AAOS Self-Learning AI, Phase C). */
  async listForTenant(tenantId: string, status?: string): Promise<readonly LearningProposalRow[]> {
    let query = this.client.from<LearningProposalRow>(TABLE).select("*").eq("tenant_id", tenantId);
    if (status !== undefined) {
      query = query.eq("status", status);
    }
    const { data, error } = await query.order("created_at", { ascending: false });
    if (error !== null) {
      throw new LearningProposalRepositoryError(
        `LearningProposalRepository.listForTenant failed: ${error.message}`,
      );
    }
    return data ?? [];
  }

  /**
   * Records a manager's real Approve/Reject decision (AAOS Self-Learning AI, Phase C — the human-
   * approval gate). `void` return, same "update returns void, caller re-reads if it needs the
   * fresh row" convention `SimulationRepository.recordDecision` already establishes for the exact
   * same real "AI recommendation needs a human decision" shape (design doc Finding #5) — no
   * `.select().single()` chained onto this write.
   */
  async updateDecision(
    id: string,
    status: "APPROVED" | "REJECTED",
    decidedBy: string | undefined,
    decisionNotes: string | undefined,
    decidedAt: string,
  ): Promise<void> {
    const { error } = await this.client
      .from<LearningProposalRow>(TABLE)
      .update({
        status,
        decided_by: decidedBy ?? null,
        decision_notes: decisionNotes ?? null,
        decided_at: decidedAt,
      })
      .eq("id", id);
    if (error !== null) {
      throw new LearningProposalRepositoryError(
        `LearningProposalRepository.updateDecision failed: ${error.message}`,
      );
    }
  }

  /**
   * AAOS Self-Improving, Phase SI-1 — real write for `ConfigApplierService.applyConfigUpdate`'s
   * auto-apply results, called from `LearningService.persistProposal` immediately after `create`
   * (never before — the proposal row must exist first). `void` return, same "update returns void,
   * caller re-reads if needed" convention `updateDecision`/`PromptOverrideRepository.deactivate`
   * already establish.
   *
   * `newStatus` is real, caller-computed: `'AUTO_APPLIED'` ONLY when the caller has confirmed every
   * improvement item on this proposal was a successfully-applied `CONFIG_UPDATE` (no
   * `PROMPT_UPDATE` item left genuinely pending human review) — see
   * `035_learning_proposals_auto_applied.sql`'s own header doc for the full reasoning. This
   * repository method trusts the caller's computed value rather than re-deriving it, same
   * "service layer decides, repository just persists" convention every other write method on this
   * class already follows.
   */
  async markAutoApplied(
    id: string,
    autoAppliedConfigKeys: readonly string[],
    newStatus: "PENDING" | "AUTO_APPLIED",
  ): Promise<void> {
    const { error } = await this.client
      .from<LearningProposalRow>(TABLE)
      .update({ auto_applied_config_keys: [...autoAppliedConfigKeys], status: newStatus })
      .eq("id", id);
    if (error !== null) {
      throw new LearningProposalRepositoryError(
        `LearningProposalRepository.markAutoApplied failed: ${error.message}`,
      );
    }
  }
}
