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

/** Real "today's average judge score per agent" + a real delta vs the average over the 7 calendar days immediately preceding today — AAOS Overview Monitor Phase O1's Finding 4 item 1. */
export interface JudgeScoreTodaySummary {
  readonly agent: string;
  /** Arithmetic mean of `scores.overall` across today's real rows for this agent. `undefined` (never a fabricated `0`) when today's window has zero real rows, mirroring `AiJudgeService`'s own `average()` helper. */
  readonly todayAverageOverall: number | undefined;
  /** Same average, over the 7 calendar days immediately BEFORE today (excludes today itself). `undefined` when that window has zero real rows. */
  readonly priorSevenDayAverageOverall: number | undefined;
  /** `todayAverageOverall - priorSevenDayAverageOverall`. `undefined` unless BOTH averages are real numbers — an undefined delta is the honest outcome when there is nothing real to compare against. */
  readonly delta: number | undefined;
  readonly todaySampleSize: number;
  readonly priorSevenDaySampleSize: number;
}

/** Start of the caller's real wall-clock UTC day — same convention `sales.service.ts`'s `startOfTodayUtc`/`go-live.service.ts`'s `startOfTodayIso` already establish elsewhere in this app (each file defines its own copy; `judge_results` had none of its own before this method). */
function startOfTodayUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
}

/** Reads a real, previously-persisted `overall` score out of a `judge_results.scores` JSONB blob — `undefined` (never `0`) when the shape is unexpected. Same real extraction `AiJudgeService`'s own module-local `extractOverall` already establishes (not exported from that file, so restated here rather than reached across module boundaries). */
function extractOverall(scores: Record<string, unknown>): number | undefined {
  const overall = scores["overall"];
  return typeof overall === "number" ? overall : undefined;
}

/** A real, honestly-computed average — `undefined` (never `0`) when `values` is empty. */
function average(values: readonly number[]): number | undefined {
  if (values.length === 0) {
    return undefined;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

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

  /** Every real `judge_results` row for one tenant+agent with `created_at >= sinceISO`, oldest-first — the raw feed `getTodayScoreSummary` partitions into "today" vs "the 7 days before today". */
  async listForTenantSince(
    tenantId: string,
    agent: string,
    sinceISO: string,
  ): Promise<readonly JudgeResultRow[]> {
    const { data, error } = await this.client
      .from<JudgeResultRow>(TABLE)
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("agent", agent)
      .gte("created_at", sinceISO)
      .order("created_at", { ascending: true });
    if (error !== null) {
      throw new JudgeResultRepositoryError(
        `JudgeResultRepository.listForTenantSince failed: ${error.message}`,
      );
    }
    return data ?? [];
  }

  /**
   * AAOS Overview Monitor Phase O1, Finding 4 item 1 — "AI score per agent, today", real (never
   * fabricated). Window definition (UTC calendar days, `startOfTodayUtc` above):
   *
   *   today          = [startOfTodayUtc(now), now)
   *   prior 7 days   = [startOfTodayUtc(now) - 7 days, startOfTodayUtc(now))  — the 7 full
   *                    calendar days immediately BEFORE today, excluding today itself (so a
   *                    same-day score never leaks into its own baseline).
   *
   * One real query (`listForTenantSince` from `priorStart`) covers both windows, partitioned
   * in-memory by each row's own real `created_at` — cheaper than two separate queries for the
   * same 8-day span. `todayAverageOverall`/`priorSevenDayAverageOverall` are the arithmetic mean
   * of each real row's `scores.overall` (a malformed/missing `overall` is excluded from both the
   * average AND its own sample count, never coerced to `0`); each is `undefined` when its window
   * has zero real rows. `delta` is `undefined` unless both averages are real numbers.
   */
  async getTodayScoreSummary(
    tenantId: string,
    agent: string,
    now: Date,
  ): Promise<JudgeScoreTodaySummary> {
    const todayStart = startOfTodayUtc(now);
    const priorStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const rows = await this.listForTenantSince(tenantId, agent, priorStart.toISOString());

    const todayStartISO = todayStart.toISOString();
    const todayOveralls = rows
      .filter((row) => row.created_at >= todayStartISO)
      .map((row) => extractOverall(row.scores))
      .filter((value): value is number => value !== undefined);
    const priorOveralls = rows
      .filter((row) => row.created_at < todayStartISO)
      .map((row) => extractOverall(row.scores))
      .filter((value): value is number => value !== undefined);

    const todayAverageOverall = average(todayOveralls);
    const priorSevenDayAverageOverall = average(priorOveralls);
    const delta =
      todayAverageOverall !== undefined && priorSevenDayAverageOverall !== undefined
        ? todayAverageOverall - priorSevenDayAverageOverall
        : undefined;

    return {
      agent,
      todayAverageOverall,
      priorSevenDayAverageOverall,
      delta,
      todaySampleSize: todayOveralls.length,
      priorSevenDaySampleSize: priorOveralls.length,
    };
  }
}
