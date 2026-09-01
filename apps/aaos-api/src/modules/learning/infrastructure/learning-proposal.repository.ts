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
 * Supabase-backed persistence for `learning_proposals` (AAOS Self-Learning AI, Phase B). Built on
 * the same shared `SupabaseClientLike` port + `SUPABASE_CLIENT` DI token every other `aaos-api`
 * repository uses (see `PromptOverrideRepository`/`SimulationRepository` for the precedent this
 * mirrors) — one Supabase client for the whole app, not a second connection.
 *
 * `create` is the ONLY write this repository (or anything in Phase B) ever performs, and it ALWAYS
 * inserts `status: 'PENDING'` with every decision column left unset — the real Approve/Reject
 * writer is Phase C (a later, separate effort), per this table's own migration header doc. No
 * `updateStatus`/`decide` method is added here speculatively.
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
}
