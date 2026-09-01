import { randomUUID } from "node:crypto";

import type { SupabaseClientLike } from "@aos/lead-store";

const TABLE = "agent_runs";

/** Raw `agent_runs` row shape (snake_case) — COLUMN-FOR-COLUMN with `supabase/migrations/028_agent_runs.sql`. */
export interface AgentRunRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly agent: string;
  readonly run_ref: string;
  readonly context: unknown;
  readonly created_at: string;
}

/** `id`/`created_at` are app-generated, same real precedent `ActivityRepository.insert` already establishes for this app's own `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` columns. */
export type AgentRunInsert = Omit<AgentRunRow, "id" | "created_at">;

export class AgentRunRepositoryError extends Error {}

/**
 * Supabase-backed persistence for `agent_runs` (AAOS-AI-JUDGE-SELF-IMPROVING, Phase J1). Built on
 * the SAME shared `SupabaseClientLike` port + `SUPABASE_CLIENT` DI token `ActivityRepository`
 * already uses — see that class's own docstring for the precedent this mirrors. Insert-only: this
 * table has no real update/delete caller (a run row is written once, at the real completion point
 * it describes, and never revised).
 */
export class AgentRunRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  async insert(values: AgentRunInsert): Promise<AgentRunRow> {
    const row: AgentRunRow = {
      id: randomUUID(),
      created_at: new Date().toISOString(),
      ...values,
    };
    const { data, error } = await this.client
      .from<AgentRunRow>(TABLE)
      .insert(row)
      .select("*")
      .single();
    if (error !== null || data === null) {
      throw new AgentRunRepositoryError(
        `AgentRunRepository.insert failed: ${error?.message ?? "no row returned"}`,
      );
    }
    return data;
  }

  /**
   * A single `agent_runs` row by id, or `undefined` when none exists — `AiJudgeService.judgeRun`'s
   * real lookup (AAOS-AI-JUDGE-SELF-IMPROVING, Phase J2), mirroring
   * `LearningProposalRepository.findById`'s exact same "`.maybeSingle()`, `undefined` on no row"
   * shape rather than throwing on a not-found id.
   */
  async findById(id: string): Promise<AgentRunRow | undefined> {
    const { data, error } = await this.client
      .from<AgentRunRow>(TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error !== null) {
      throw new AgentRunRepositoryError(`AgentRunRepository.findById failed: ${error.message}`);
    }
    return data ?? undefined;
  }
}
