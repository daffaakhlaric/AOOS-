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
  readonly agent: string;
  readonly analysis: string | null;
  readonly gaps: Record<string, unknown>;
  readonly improvements: readonly Record<string, unknown>[];
  readonly status: string;
  readonly decided_by: string | null;
  readonly decision_notes: string | null;
  readonly decided_at: string | null;
  readonly created_at: string;
}

export interface CreateLearningProposalInput {
  readonly tenantId: string;
  readonly simulationId: string;
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
    const { data, error } = await this.client
      .from<LearningProposalRow>(TABLE)
      .insert({
        tenant_id: input.tenantId,
        simulation_id: input.simulationId,
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
}
