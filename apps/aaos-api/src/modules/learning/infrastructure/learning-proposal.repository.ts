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
  /**
   * AAOS Self-Improving, Phase SI-5 (`039_learning_proposals_sandbox_gate.sql`) — the real
   * `PROMPT_UPDATE` items this proposal's `LearningService.persistProposal` step tried to
   * auto-apply but `SandboxService.testImprovement` honestly found WORSE than baseline (a real,
   * negative `delta` — see `SandboxService`'s own class doc for exactly what this can and cannot
   * measure), so no `agent_prompt_overrides` write was made for that item. `[]` when nothing was
   * ever blocked this way. Each entry carries the real `SandboxTestResult` that caused the block, so
   * a human reviewing this proposal (or forcing it through `LearningDecisionService.approve`) sees
   * the real reason, never a bare status flag with no evidence.
   */
  readonly sandbox_blocked_items: readonly Record<string, unknown>[];
  /**
   * AAOS Self-Improving, Phase SI-3 (`037_learning_proposals_self_analysis.sql`) — the real, optional
   * output of a PRIOR, SEPARATE `LlmService.selfAnalyze` call over this SAME gap (`rootCauses`/
   * `patterns`/`confidence` — see `dto/self-analysis.dto.ts`'s own `SelfAnalysisLlmPayloadSchema`,
   * the shape this JSONB column mirrors). `null` when self-analysis wasn't run or was unavailable/
   * degraded when this proposal was created — an honest "no self-analysis for this row", never a
   * fabricated empty object. Additive, nullable — never blocks proposal creation (see
   * `LearningService`'s own doc for the full best-effort reasoning).
   */
  readonly self_analysis: Record<string, unknown> | null;
  /**
   * AAOS Self-Improving, Phase SI-6 (`040_learning_proposals_accuracy_check.sql`) — the real,
   * honest verdict of `AccuracyCheckService`'s weekly real-world accuracy check, comparing real
   * `judge_results.scores.overall` averages for this proposal's tenant+agent BEFORE vs AFTER this
   * row's own `created_at`. `null` until the first real weekly check reaches this row. See that
   * migration's own header doc for the full "why a separate column, not overloading `status`"
   * reasoning and the real meaning of each value.
   */
  readonly accuracy_verdict: "IMPROVED" | "REGRESSED" | "INCONCLUSIVE" | null;
  /** Real, human-readable explanation of `accuracy_verdict` (sample sizes / real delta / real threshold) — `null` until checked. */
  readonly accuracy_reason: string | null;
  /** Real average `judge_results.scores.overall` for this tenant+agent BEFORE this proposal's `created_at` — `null` when the before-side sample size was 0. */
  readonly accuracy_score_before: number | null;
  /** Real average `judge_results.scores.overall` for this tenant+agent AFTER (inclusive) this proposal's `created_at` — `null` when the after-side sample size was 0. */
  readonly accuracy_score_after: number | null;
  /** Real COUNT of judge_results rows `accuracy_score_before` was computed over — `null` only until the first real check runs, `0` is a valid, honest value afterward. */
  readonly accuracy_sample_before: number | null;
  /** Real COUNT of judge_results rows `accuracy_score_after` was computed over — same "null only pre-check, 0 is honest afterward" convention as `accuracy_sample_before`. */
  readonly accuracy_sample_after: number | null;
  /** When this row was last real-checked by `AccuracyCheckService` — `null` until the first real weekly run reaches it. */
  readonly accuracy_checked_at: string | null;
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
  /** AAOS Self-Improving, Phase SI-3 — real, optional `LlmService.selfAnalyze` output for this SAME gap, persisted alongside the proposal (see `LearningProposalRow.self_analysis`'s own doc). `undefined` when self-analysis wasn't run or was unavailable — `create` stores it as `null`, never a fabricated value. */
  readonly selfAnalysis?: Record<string, unknown>;
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
        self_analysis: input.selfAnalysis ?? null,
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
   * AAOS Self-Improving, Phase SI-2: `autoAppliedConfigKeys` now also carries any successfully
   * auto-applied `LOGIC_UPDATE` `target` (`logic_key`), via the exact same real column — a
   * deliberate reuse (not a new column) since both are "which key(s) this proposal auto-applied,
   * regardless of whether the underlying table was `agent_configs` or `agent_logic`", the same real
   * fact for a Learning Monitor UI either way; `LearningService.persistProposal` is the one real
   * place that decides which applier (`configApplier`/`logicApplier`) produced each key.
   *
   * `newStatus` is real, caller-computed: `'AUTO_APPLIED'` ONLY when the caller has confirmed every
   * improvement item on this proposal was successfully applied (`CONFIG_UPDATE`/`LOGIC_UPDATE`, and
   * as of Phase SI-5, a sandbox-cleared `PROMPT_UPDATE` too — no item left genuinely pending human
   * review); `'AUTO_APPLY_BLOCKED_BY_SANDBOX'` (Phase SI-5,
   * `039_learning_proposals_sandbox_gate.sql`) when every item is either applied or honestly
   * sandbox-blocked (see `sandboxBlockedItems`'s own field doc) — see
   * `035_learning_proposals_auto_applied.sql`'s own header doc for the full "why 2 real columns, not
   * overloading status" reasoning this phase extends rather than replaces. This repository method
   * trusts the caller's computed value rather than re-deriving it, same "service layer decides,
   * repository just persists" convention every other write method on this class already follows.
   *
   * AAOS Self-Improving, Phase SI-5 — `sandboxBlockedItems` is the real, additive sibling of
   * `autoAppliedConfigKeys`: every `PROMPT_UPDATE` item this proposal's `persistProposal` step tried
   * to auto-apply but a real, negative `SandboxService.testImprovement` result blocked (see
   * `LearningProposalRow.sandbox_blocked_items`'s own doc). `[]` when nothing was blocked.
   */
  async markAutoApplied(
    id: string,
    autoAppliedConfigKeys: readonly string[],
    newStatus: "PENDING" | "AUTO_APPLIED" | "AUTO_APPLY_BLOCKED_BY_SANDBOX",
    sandboxBlockedItems: readonly Record<string, unknown>[] = [],
  ): Promise<void> {
    const { error } = await this.client
      .from<LearningProposalRow>(TABLE)
      .update({
        auto_applied_config_keys: [...autoAppliedConfigKeys],
        sandbox_blocked_items: [...sandboxBlockedItems],
        status: newStatus,
      })
      .eq("id", id);
    if (error !== null) {
      throw new LearningProposalRepositoryError(
        `LearningProposalRepository.markAutoApplied failed: ${error.message}`,
      );
    }
  }

  /**
   * The tenant's most recent `learning_proposals` rows for ONE real `agent`, oldest-first — AAOS
   * Self-Improving, Phase SI-5's real read for `JudgeMemoryService.build` (which real proposals
   * actually applied something for this tenant+agent, so it can honestly compute a real judge-score
   * trend around each — see that class's own doc). Mirrors `listRecentForTenant`'s exact same shape,
   * scoped additionally by `agent` (matches `idx_learning_proposals_tenant_agent`).
   */
  async listRecentForTenantAgent(
    tenantId: string,
    agent: string,
    limit = 10,
  ): Promise<readonly LearningProposalRow[]> {
    const { data, error } = await this.client
      .from<LearningProposalRow>(TABLE)
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("agent", agent)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error !== null) {
      throw new LearningProposalRepositoryError(
        `LearningProposalRepository.listRecentForTenantAgent failed: ${error.message}`,
      );
    }
    return [...(data ?? [])].reverse();
  }

  /**
   * AAOS Self-Improving, Phase SI-6 — the real, bounded read `AccuracyCheckService.
   * runWeeklyAccuracyCheck` scans every real run: every proposal that genuinely applied something
   * (`status IN ('AUTO_APPLIED', 'AUTO_APPLY_BLOCKED_BY_SANDBOX')`) whose `accuracy_verdict` has
   * never been computed (`NULL`) OR was last computed as `'INCONCLUSIVE'` (real, honest "insufficient
   * data at the time" — worth re-checking as more real judge_results accumulate). A row whose verdict
   * is already `'IMPROVED'`/`'REGRESSED'` is a real, stable, already-computed answer and is not
   * re-scanned. Oldest-first (`created_at` ascending) so the longest-waiting real proposals are
   * checked first when `limit` is reached — mirrors `idx_learning_proposals_accuracy_pending`
   * (`040_learning_proposals_accuracy_check.sql`) exactly.
   *
   * REAL PORT CONSTRAINT: the shared `SupabaseClientLike` port (`@aos/lead-store`'s
   * `SupabaseTypes.ts`) exposes only `eq`/`gte`/`lte` filters — no `.in()`/`.or()` (same real
   * constraint `AgentConfigRepository.upsert`'s own doc documents for `.upsert()`). So this method
   * issues one real `eq("status", ...)` query PER status value (there are only 2, a small, bounded
   * real fan-out) and does the `accuracy_verdict IS NULL OR = 'INCONCLUSIVE'` filter, the merge, and
   * the final `limit` truncation in-app — never a single unsupported compound query.
   */
  async listNeedingAccuracyCheck(limit = 200): Promise<readonly LearningProposalRow[]> {
    const [autoApplied, sandboxBlocked] = await Promise.all([
      this.listByStatusForAccuracyScan("AUTO_APPLIED"),
      this.listByStatusForAccuracyScan("AUTO_APPLY_BLOCKED_BY_SANDBOX"),
    ]);
    const merged = [...autoApplied, ...sandboxBlocked]
      .filter((row) => row.accuracy_verdict === null || row.accuracy_verdict === "INCONCLUSIVE")
      .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
    return merged.slice(0, limit);
  }

  private async listByStatusForAccuracyScan(
    status: string,
  ): Promise<readonly LearningProposalRow[]> {
    const { data, error } = await this.client
      .from<LearningProposalRow>(TABLE)
      .select("*")
      .eq("status", status)
      .order("created_at", { ascending: true });
    if (error !== null) {
      throw new LearningProposalRepositoryError(
        `LearningProposalRepository.listNeedingAccuracyCheck (status=${status}) failed: ${error.message}`,
      );
    }
    return data ?? [];
  }

  /**
   * AAOS Self-Improving, Phase SI-6 — the real write for one `AccuracyCheckService.checkOne` result.
   * `void` return, same "update returns void, caller re-reads if needed" convention every other
   * write method on this class already establishes (`updateDecision`/`markAutoApplied`).
   */
  async recordAccuracyCheck(
    id: string,
    result: {
      readonly verdict: "IMPROVED" | "REGRESSED" | "INCONCLUSIVE";
      readonly reason: string;
      readonly scoreBefore: number | null;
      readonly scoreAfter: number | null;
      readonly sampleBefore: number;
      readonly sampleAfter: number;
      readonly checkedAt: string;
    },
  ): Promise<void> {
    const { error } = await this.client
      .from<LearningProposalRow>(TABLE)
      .update({
        accuracy_verdict: result.verdict,
        accuracy_reason: result.reason,
        accuracy_score_before: result.scoreBefore,
        accuracy_score_after: result.scoreAfter,
        accuracy_sample_before: result.sampleBefore,
        accuracy_sample_after: result.sampleAfter,
        accuracy_checked_at: result.checkedAt,
      })
      .eq("id", id);
    if (error !== null) {
      throw new LearningProposalRepositoryError(
        `LearningProposalRepository.recordAccuracyCheck failed: ${error.message}`,
      );
    }
  }
}
