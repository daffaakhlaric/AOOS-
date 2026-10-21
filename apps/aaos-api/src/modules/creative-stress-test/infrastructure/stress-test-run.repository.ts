import type { SupabaseClientLike } from "@aos/lead-store";

import type {
  ObjectionSourceKey,
  PersonaPresetId,
  StoredStressTestRun,
  StressTestEvaluatedResult,
  StressTestMode,
  StressTestPartialResult,
  StressTestPrimaryGoal,
  StressTestResult,
  StressTestRunProgress,
  StressTestSourceType,
  StressTestStatus,
  StressTestWaitingForEngineResult,
} from "../domain/stress-test-run.js";

const TABLE = "stress_test_runs";

/** Raw `stress_test_runs` row shape (snake_case) — COLUMN-FOR-COLUMN with the migration. */
export interface StressTestRunRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly name: string;
  readonly source_type: string;
  readonly listing_id: string | null;
  readonly campaign_id: string | null;
  readonly campaign_draft_id: string | null;
  readonly creative_ids: readonly string[];
  readonly mode: string;
  readonly primary_goal: string;
  readonly persona_ids: readonly string[];
  readonly objection_sources: readonly string[];
  readonly status: string;
  readonly result: unknown;
  readonly failed_reason: string | null;
  readonly created_at: string;
  readonly completed_at: string | null;
}

export interface CreateStressTestRunInput {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly sourceType: StressTestSourceType;
  readonly listingId?: string;
  readonly campaignId?: string;
  readonly campaignDraftId?: string;
  readonly creativeIds: readonly string[];
  readonly mode: StressTestMode;
  readonly primaryGoal: StressTestPrimaryGoal;
  readonly personaIds: readonly PersonaPresetId[];
  readonly objectionSources: readonly ObjectionSourceKey[];
}

export class StressTestRunRepositoryError extends Error {}

function toDomain(row: StressTestRunRow): StoredStressTestRun {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    sourceType: row.source_type as StressTestSourceType,
    ...(row.listing_id !== null ? { listingId: row.listing_id } : {}),
    ...(row.campaign_id !== null ? { campaignId: row.campaign_id } : {}),
    ...(row.campaign_draft_id !== null ? { campaignDraftId: row.campaign_draft_id } : {}),
    creativeIds: row.creative_ids,
    mode: row.mode as StressTestMode,
    primaryGoal: row.primary_goal as StressTestPrimaryGoal,
    personaIds: row.persona_ids as PersonaPresetId[],
    objectionSources: row.objection_sources as ObjectionSourceKey[],
    status: row.status as StressTestStatus,
    result: row.result === null ? null : (row.result as StressTestResult),
    ...(row.failed_reason !== null ? { failedReason: row.failed_reason } : {}),
    createdAt: row.created_at,
    ...(row.completed_at !== null ? { completedAt: row.completed_at } : {}),
  };
}

/**
 * Supabase-backed persistence for `stress_test_runs` (Creative Stress Test, First Boundary), on
 * the same shared `SupabaseClientLike` port + `SUPABASE_CLIENT` DI token every other `aaos-api`
 * repository uses. Structural template: `modules/abtesting/infrastructure/ab-test.repository.ts`.
 *
 * Deliberately does NOT touch `modules/simulation`'s `simulations` table or repository — separate
 * feature, separate table, per the naming-collision warning this module's brief carries.
 */
export class StressTestRunRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  async create(input: CreateStressTestRunInput): Promise<StoredStressTestRun> {
    const { data, error } = await this.client
      .from<StressTestRunRow>(TABLE)
      .insert({
        id: input.id,
        tenant_id: input.tenantId,
        name: input.name,
        source_type: input.sourceType,
        listing_id: input.listingId ?? null,
        campaign_id: input.campaignId ?? null,
        campaign_draft_id: input.campaignDraftId ?? null,
        creative_ids: input.creativeIds,
        mode: input.mode,
        primary_goal: input.primaryGoal,
        persona_ids: input.personaIds,
        objection_sources: input.objectionSources,
        status: "DRAFT",
        result: null,
        failed_reason: null,
        completed_at: null,
      })
      .select("*")
      .single();
    if (error !== null || data === null) {
      throw new StressTestRunRepositoryError(
        `StressTestRunRepository.create failed: ${error?.message ?? "no row returned"}`,
      );
    }
    return toDomain(data);
  }

  async findById(tenantId: string, id: string): Promise<StoredStressTestRun | undefined> {
    const { data, error } = await this.client
      .from<StressTestRunRow>(TABLE)
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .maybeSingle();
    if (error !== null) {
      throw new StressTestRunRepositoryError(
        `StressTestRunRepository.findById failed: ${error.message}`,
      );
    }
    return data === null ? undefined : toDomain(data);
  }

  async listByTenant(tenantId: string): Promise<readonly StoredStressTestRun[]> {
    const { data, error } = await this.client
      .from<StressTestRunRow>(TABLE)
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    if (error !== null) {
      throw new StressTestRunRepositoryError(
        `StressTestRunRepository.listByTenant failed: ${error.message}`,
      );
    }
    return (data ?? []).map(toDomain);
  }

  async markStatus(id: string, status: StressTestStatus): Promise<void> {
    const { error } = await this.client
      .from<StressTestRunRow>(TABLE)
      .update({ status })
      .eq("id", id);
    if (error !== null) {
      throw new StressTestRunRepositoryError(
        `StressTestRunRepository.markStatus failed: ${error.message}`,
      );
    }
  }

  /**
   * Legacy First Boundary transition — kept only so any existing test/tooling that still exercises
   * the honest `WAITING_FOR_ENGINE` marker keeps working. `CreativeStressTestService.execute` no
   * longer calls this (see that method's own doc) — every new run lands on `markCompleted` or
   * `markFailed`.
   */
  async markWaitingForEngine(
    id: string,
    result: StressTestWaitingForEngineResult,
    completedAtIso: string,
  ): Promise<void> {
    const { error } = await this.client
      .from<StressTestRunRow>(TABLE)
      .update({ status: "WAITING_FOR_ENGINE", result, completed_at: completedAtIso })
      .eq("id", id);
    if (error !== null) {
      throw new StressTestRunRepositoryError(
        `StressTestRunRepository.markWaitingForEngine failed: ${error.message}`,
      );
    }
  }

  /**
   * Creative Stress Test, Second Boundary — transitions a run to the real terminal `COMPLETED`
   * state with a real, persisted `StressTestEvaluatedResult` (never a fabricated one — see that
   * type's own doc and `CreativeStressTestService.execute`'s composition of it).
   */
  async markCompleted(
    id: string,
    result: StressTestEvaluatedResult,
    completedAtIso: string,
  ): Promise<void> {
    const { error } = await this.client
      .from<StressTestRunRow>(TABLE)
      .update({ status: "COMPLETED", result, completed_at: completedAtIso })
      .eq("id", id);
    if (error !== null) {
      throw new StressTestRunRepositoryError(
        `StressTestRunRepository.markCompleted failed: ${error.message}`,
      );
    }
  }

  /**
   * `RUNNING` + the initial per-evaluator progress in ONE write. Progress lives inside the existing
   * `result` jsonb as `{ kind: "IN_PROGRESS", progress }` (no new column, no migration).
   */
  async markRunning(id: string, progress: StressTestRunProgress): Promise<void> {
    const { error } = await this.client
      .from<StressTestRunRow>(TABLE)
      .update({ status: "RUNNING", result: { kind: "IN_PROGRESS", progress } })
      .eq("id", id);
    if (error !== null) {
      throw new StressTestRunRepositoryError(
        `StressTestRunRepository.markRunning failed: ${error.message}`,
      );
    }
  }

  /**
   * One progress write per evaluator state change. Guarded by `status = RUNNING` so a late write
   * can never overwrite a terminal (COMPLETED/FAILED/CANCELLED) row's result.
   */
  async updateProgress(id: string, progress: StressTestRunProgress): Promise<void> {
    const { error } = await this.client
      .from<StressTestRunRow>(TABLE)
      .update({ result: { kind: "IN_PROGRESS", progress } })
      .eq("id", id)
      .eq("status", "RUNNING");
    if (error !== null) {
      throw new StressTestRunRepositoryError(
        `StressTestRunRepository.updateProgress failed: ${error.message}`,
      );
    }
  }

  /**
   * `FAILED` with a real reason. When `partial` is given it is persisted as `result` (real evaluator
   * outputs that settled before the failure, `partial: true`, never a score); otherwise `result` is
   * left untouched (legacy behaviour).
   */
  async markFailed(
    id: string,
    reason: string,
    completedAtIso?: string,
    partial?: StressTestPartialResult,
  ): Promise<void> {
    const { error } = await this.client
      .from<StressTestRunRow>(TABLE)
      .update({
        status: "FAILED",
        failed_reason: reason,
        ...(completedAtIso !== undefined ? { completed_at: completedAtIso } : {}),
        ...(partial !== undefined ? { result: partial } : {}),
      })
      .eq("id", id);
    if (error !== null) {
      throw new StressTestRunRepositoryError(
        `StressTestRunRepository.markFailed failed: ${error.message}`,
      );
    }
  }
}
