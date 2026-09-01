import { randomUUID } from "node:crypto";

import type { SupabaseClientLike } from "@aos/lead-store";

const TABLE = "judge_results";

/** Raw `judge_results` row shape (snake_case) — COLUMN-FOR-COLUMN with `supabase/migrations/029_judge_results.sql`. */
export interface JudgeResultRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly agent: string;
  readonly run_id: string;
  readonly scores: Record<string, unknown>;
  readonly strengths: unknown;
  readonly gaps: unknown;
  readonly notes: string | null;
  readonly created_at: string;
}

export interface CreateJudgeResultInput {
  readonly tenantId: string;
  readonly agent: string;
  readonly runId: string;
  readonly scores: Record<string, unknown>;
  readonly strengths: readonly unknown[];
  readonly gaps: readonly unknown[];
  readonly notes: string;
}

export class JudgeResultRepositoryError extends Error {}

/**
 * Supabase-backed persistence for `judge_results` (AAOS-AI-JUDGE-SELF-IMPROVING, Phase J2). Built
 * on the SAME shared `SupabaseClientLike` port + `SUPABASE_CLIENT` DI token `AgentRunRepository`/
 * `LearningProposalRepository` already use — one Supabase client for the whole app, not a second
 * connection. `id`/`created_at` are app-generated, same real precedent `AgentRunRepository.insert`
 * already establishes for this app's own `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` columns.
 */
export class JudgeResultRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  async insert(input: CreateJudgeResultInput): Promise<JudgeResultRow> {
    const row: JudgeResultRow = {
      id: randomUUID(),
      tenant_id: input.tenantId,
      agent: input.agent,
      run_id: input.runId,
      scores: input.scores,
      strengths: input.strengths,
      gaps: input.gaps,
      notes: input.notes,
      created_at: new Date().toISOString(),
    };
    const { data, error } = await this.client
      .from<JudgeResultRow>(TABLE)
      .insert(row)
      .select("*")
      .single();
    if (error !== null || data === null) {
      throw new JudgeResultRepositoryError(
        `JudgeResultRepository.insert failed: ${error?.message ?? "no row returned"}`,
      );
    }
    return data;
  }

  /**
   * The tenant's most recent `judge_results` rows for one real `agent`, oldest-first — real "judge
   * memory" `AiJudgeService.judgeRun` feeds into `LlmService.judgeAgentRun`'s prompt as trend
   * context. Mirrors `LearningProposalRepository.listRecentForTenant`'s exact same shape (Finding 4
   * of `docs/PROMPT-AAOS-AI-JUDGE-SELF-IMPROVING.md`: widen this same real pattern rather than build
   * a separate `judge_memory` table), scoped additionally by `agent` (via `idx_judge_results_tenant_agent`).
   */
  async listRecentForTenant(
    tenantId: string,
    agent: string,
    limit = 10,
  ): Promise<readonly JudgeResultRow[]> {
    const { data, error } = await this.client
      .from<JudgeResultRow>(TABLE)
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("agent", agent)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error !== null) {
      throw new JudgeResultRepositoryError(
        `JudgeResultRepository.listRecentForTenant failed: ${error.message}`,
      );
    }
    return [...(data ?? [])].reverse();
  }
}
