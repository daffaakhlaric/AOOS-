import type {
  SimulationLogEntry,
  SimulationLogPayload,
  SimulationResult,
  StoredSimulation,
} from "../domain/simulation-record.js";

/** `GET /api/v1/simulation/:id/status` response — the dashboard's polling contract (coordinator note #8). */
export interface SimulationStatusResponseDto {
  readonly id: string;
  readonly status: "RUNNING" | "DONE" | "ERROR" | "LIVE" | "ROLLED_BACK";
  readonly currentStep: string;
  readonly campaignDataSource: "cache" | "fresh";
  readonly personaIds: readonly string[];
  readonly branch?: string;
  readonly result?: SimulationResult;
  readonly errorMessage?: string;
  readonly decision?: "APPROVED" | "REJECTED";
  readonly decidedBy?: string;
  readonly decisionNotes?: string;
  readonly decidedAt?: string;
  /** AAOS-GO-LIVE additions — present only once `status` is `'LIVE'` or `'ROLLED_BACK'`. */
  readonly liveCampaignId?: string;
  readonly liveAdId?: string;
  readonly liveAt?: string;
  readonly rolledBackAt?: string;
  /**
   * `result.samantha.audienceTargeting` (AAOS-SIMULASI-TARGETING) rides along inside `result` — no
   * separate top-level field, exactly like `samantha`/`kai` already do.
   *
   * `logs[].payload` is populated only for the targeting step (the sole writer of
   * `simulation_logs.payload`); every other line omits it.
   */
  readonly logs: ReadonlyArray<{
    readonly step: string;
    readonly level: string;
    readonly message: string;
    readonly payload?: SimulationLogPayload;
    readonly createdAt: string;
  }>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function toSimulationStatusResponseDto(
  simulation: StoredSimulation,
  logs: readonly SimulationLogEntry[],
): SimulationStatusResponseDto {
  return {
    id: simulation.id,
    status: simulation.status,
    currentStep: simulation.currentStep,
    campaignDataSource: simulation.campaignDataSource,
    personaIds: simulation.personaIds,
    branch: simulation.branch,
    result: simulation.result,
    errorMessage: simulation.errorMessage,
    decision: simulation.decision,
    decidedBy: simulation.decidedBy,
    decisionNotes: simulation.decisionNotes,
    decidedAt: simulation.decidedAt,
    liveCampaignId: simulation.liveCampaignId,
    liveAdId: simulation.liveAdId,
    liveAt: simulation.liveAt,
    rolledBackAt: simulation.rolledBackAt,
    logs,
    createdAt: simulation.createdAt,
    updatedAt: simulation.updatedAt,
  };
}

/** `GET /api/v1/simulation/history` — one row per past run, no per-persona/log detail (that's what `.../:id/status` is for). */
export interface SimulationHistoryEntryDto {
  readonly id: string;
  readonly status: "RUNNING" | "DONE" | "ERROR" | "LIVE" | "ROLLED_BACK";
  readonly overallScore?: number;
  readonly grade?: string;
  readonly verdict?: string;
  readonly decision?: "APPROVED" | "REJECTED";
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function toSimulationHistoryEntryDto(
  simulation: StoredSimulation,
): SimulationHistoryEntryDto {
  return {
    id: simulation.id,
    status: simulation.status,
    overallScore: simulation.result?.scoring.overallScore,
    grade: simulation.result?.scoring.grade,
    verdict: simulation.result?.scoring.verdict,
    decision: simulation.decision,
    createdAt: simulation.createdAt,
    updatedAt: simulation.updatedAt,
  };
}
