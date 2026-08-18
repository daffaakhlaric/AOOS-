import type { SupabaseClientLike } from "@aos/lead-store";

import type {
  SimulationDecision,
  SimulationLogEntry,
  SimulationLogPayload,
  SimulationResult,
  SimulationStatus,
  SimulationStep,
  StoredSimulation,
} from "../domain/simulation-record.js";

const TABLE = "simulations";
const LOG_TABLE = "simulation_logs";

/** Raw `simulations` row shape (snake_case) — see `supabase/migrations/001_simulations.sql`. */
interface SimulationRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly objective_snapshot: Record<string, unknown>;
  readonly campaign_data_source: string;
  readonly persona_ids: string[];
  readonly branch: string | null;
  readonly status: string;
  readonly current_step: string;
  readonly result: SimulationResult | null;
  readonly error_message: string | null;
  readonly decision: string | null;
  readonly decided_by: string | null;
  readonly decision_notes: string | null;
  readonly decided_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

interface SimulationLogRow {
  readonly simulation_id: string;
  readonly step: string;
  readonly level: string;
  readonly message: string;
  /**
   * AAOS-SIMULASI-TARGETING: `simulation_logs.payload` has existed in
   * `supabase/migrations/001_simulations.sql` since the table was created but was never written
   * until now. The targeting step writes its real candidate/selected/rejected interest ids here;
   * every other log line leaves it `null`.
   */
  readonly payload: SimulationLogPayload | null;
  readonly created_at: string;
}

export class SimulationRepositoryError extends Error {}

function toDomain(row: SimulationRow): StoredSimulation {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    objectiveSnapshot: row.objective_snapshot,
    campaignDataSource: row.campaign_data_source === "fresh" ? "fresh" : "cache",
    personaIds: row.persona_ids,
    branch: row.branch ?? undefined,
    status: row.status as SimulationStatus,
    currentStep: row.current_step as SimulationStep,
    result: row.result ?? undefined,
    errorMessage: row.error_message ?? undefined,
    decision: (row.decision as SimulationDecision | null) ?? undefined,
    decidedBy: row.decided_by ?? undefined,
    decisionNotes: row.decision_notes ?? undefined,
    decidedAt: row.decided_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateSimulationInput {
  readonly id: string;
  readonly tenantId: string;
  readonly objectiveSnapshot: Record<string, unknown>;
  readonly campaignDataSource: "cache" | "fresh";
  readonly personaIds: readonly string[];
  readonly branch?: string;
}

/**
 * Supabase-backed persistence for `simulations`/`simulation_logs` (coordinator note #7), same
 * hand-rolled `SupabaseClientLike` port `@aos/lead-store`'s own repositories use (see
 * `ClosingRepository.ts`) — no direct dependency on `@supabase/supabase-js`'s real generic-heavy
 * client type. Shares the SAME Supabase client `app.module.ts` already builds for `@aos/
 * lead-store` (`SUPABASE_CLIENT` DI token), not a second connection.
 */
export class SimulationRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  async create(input: CreateSimulationInput): Promise<StoredSimulation> {
    const { data, error } = await this.client
      .from<SimulationRow>(TABLE)
      .insert({
        id: input.id,
        tenant_id: input.tenantId,
        objective_snapshot: input.objectiveSnapshot,
        campaign_data_source: input.campaignDataSource,
        persona_ids: [...input.personaIds],
        branch: input.branch ?? null,
        status: "RUNNING",
        current_step: "SETUP",
      })
      .select("*")
      .single();
    if (error !== null || data === null) {
      throw new SimulationRepositoryError(
        `SimulationRepository.create failed: ${error?.message ?? "no row returned"}`,
      );
    }
    return toDomain(data);
  }

  async findById(id: string): Promise<StoredSimulation | undefined> {
    const { data, error } = await this.client
      .from<SimulationRow>(TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error !== null) {
      throw new SimulationRepositoryError(`SimulationRepository.findById failed: ${error.message}`);
    }
    return data === null ? undefined : toDomain(data);
  }

  async list(limit = 50): Promise<readonly StoredSimulation[]> {
    const { data, error } = await this.client
      .from<SimulationRow>(TABLE)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error !== null) {
      throw new SimulationRepositoryError(`SimulationRepository.list failed: ${error.message}`);
    }
    return (data ?? []).map(toDomain);
  }

  /** Advances `current_step` mid-pipeline — used between stages so `GET .../status` polling reflects real progress, not just a final result. */
  async updateStep(id: string, step: SimulationStep): Promise<void> {
    const { error } = await this.client
      .from<SimulationRow>(TABLE)
      .update({ current_step: step, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error !== null) {
      throw new SimulationRepositoryError(
        `SimulationRepository.updateStep failed: ${error.message}`,
      );
    }
  }

  async complete(id: string, result: SimulationResult): Promise<void> {
    const { error } = await this.client
      .from<SimulationRow>(TABLE)
      .update({
        status: "DONE",
        current_step: "DONE",
        result,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error !== null) {
      throw new SimulationRepositoryError(`SimulationRepository.complete failed: ${error.message}`);
    }
  }

  async fail(id: string, errorMessage: string): Promise<void> {
    const { error } = await this.client
      .from<SimulationRow>(TABLE)
      .update({
        status: "ERROR",
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error !== null) {
      throw new SimulationRepositoryError(`SimulationRepository.fail failed: ${error.message}`);
    }
  }

  async recordDecision(
    id: string,
    decision: SimulationDecision,
    decidedBy: string | undefined,
    notes: string | undefined,
    decidedAt: string,
  ): Promise<void> {
    const { error } = await this.client
      .from<SimulationRow>(TABLE)
      .update({
        decision,
        decided_by: decidedBy ?? null,
        decision_notes: notes ?? null,
        decided_at: decidedAt,
        current_step: "DONE",
        updated_at: decidedAt,
      })
      .eq("id", id);
    if (error !== null) {
      throw new SimulationRepositoryError(
        `SimulationRepository.recordDecision failed: ${error.message}`,
      );
    }
  }

  async appendLog(id: string, entry: SimulationLogEntry): Promise<void> {
    const { error } = await this.client.from<SimulationLogRow>(LOG_TABLE).insert({
      simulation_id: id,
      step: entry.step,
      level: entry.level,
      message: entry.message,
      payload: entry.payload ?? null,
      created_at: entry.createdAt,
    });
    if (error !== null) {
      throw new SimulationRepositoryError(
        `SimulationRepository.appendLog failed: ${error.message}`,
      );
    }
  }

  async listLogs(id: string): Promise<readonly SimulationLogEntry[]> {
    const { data, error } = await this.client
      .from<SimulationLogRow>(LOG_TABLE)
      .select("*")
      .eq("simulation_id", id)
      .order("created_at", { ascending: true });
    if (error !== null) {
      throw new SimulationRepositoryError(`SimulationRepository.listLogs failed: ${error.message}`);
    }
    return (data ?? []).map((row) => ({
      step: row.step as SimulationStep,
      level: row.level as "INFO" | "WARN" | "ERROR",
      message: row.message,
      // `?? null` guards rows written before `payload` was ever populated, where Supabase returns
      // the column as `null` — omitted rather than surfaced as an empty object.
      ...((row.payload ?? null) !== null ? { payload: row.payload as SimulationLogPayload } : {}),
      createdAt: row.created_at,
    }));
  }
}
