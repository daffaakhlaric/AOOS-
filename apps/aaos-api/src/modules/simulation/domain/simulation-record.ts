/**
 * Domain shapes for one dry-run simulation record (AAOS-DASHBOARD-SIMULASI). Kept in one file,
 * mirroring `creative-package.store.ts`'s precedent of a small, self-contained domain shape for a
 * module with no upstream `@aos/*` package of its own.
 */

/** The 6-step wizard's step names, in order — also `simulations.current_step`'s real values. */
export type SimulationStep = "SETUP" | "TAMARA" | "KAI" | "JESSY" | "JUDGE" | "REVIEW" | "DONE";

export type SimulationStatus = "RUNNING" | "DONE" | "ERROR";

export type SimulationDecision = "APPROVED" | "REJECTED";

/** Step 2 (Tamara) result — the REAL `AnalyzeLlmPayload` shape from `POST /api/v1/llm/analyze`, or `undefined` when Tamara was unavailable (never fabricated). */
export interface TamaraStageResult {
  readonly available: boolean;
  readonly reason?: string;
  readonly temuan?: ReadonlyArray<{
    readonly icon: string;
    readonly judul: string;
    readonly detail: string;
  }>;
  readonly rekomendasi?: ReadonlyArray<{
    readonly aksi: string;
    readonly target: string;
    readonly alasan: string;
    readonly estimasi: string;
  }>;
  readonly ringkasan?: string;
  readonly elapsedMs: number;
  /**
   * `/api/v1/llm/analyze` has no native numeric score (its real response is qualitative — see
   * `llm.service.ts`). This is a deterministic, inspectable PROXY score derived from real response
   * field counts (never a fabricated/hallucinated number) — used only as one input to this
   * simulation's overall gate. See `domain/scoring.ts`'s `scoreTamaraCoverage` for the exact
   * formula.
   */
  readonly coverageScore: number;
}

/** Step 3 (Kai) result. `videoGenerated`/`imageGenerated` are honestly `false` in this pass — see this module's class docs for why real Kie AI video generation is not invoked here. */
export interface KaiStageResult {
  readonly available: boolean;
  readonly reason?: string;
  readonly brief?: {
    readonly unit: string;
    readonly angle: string;
    readonly branch: string;
    readonly primaryMessage: string;
    readonly tone: string;
    readonly formats: readonly string[];
    readonly avoid: readonly string[];
    readonly urgency: string;
  };
  readonly elapsedMs: number;
  readonly videoGenerated: false;
  readonly note: string;
}

/** One persona's real Jessy simulation + AI Judge result, proxied from `apps/aaos-simulator`'s `POST /api/simulate`. Fields are the exact subset this module needs for scoring/display — see `infrastructure/aaos-simulator-client.ts` for the full upstream response types. */
export interface JessyPersonaRun {
  readonly personaId: string;
  readonly ok: boolean;
  readonly error?: string;
  readonly finalScore?: number;
  readonly finalTemperature?: string;
  readonly handoffTriggered?: boolean;
  readonly totalTurns?: number;
  readonly overallScore?: number;
  readonly grade?: string;
  readonly verdict?: string;
  readonly feedbackItems?: ReadonlyArray<{ readonly dimension: string; readonly message: string }>;
}

/** Step 4+5 (Jessy + AI Judge) — one run per selected `PersonaId`. */
export interface JessyStageResult {
  readonly available: boolean;
  readonly reason?: string;
  readonly runs: readonly JessyPersonaRun[];
  readonly elapsedMs: number;
}

export type Grade = "A" | "B" | "C" | "D" | "F";
export type Verdict = "GO" | "CONDITIONAL" | "NO-GO" | "INCOMPLETE";

/** Computed overall gate — see `domain/scoring.ts` for the formula and its judgment-call caveats. */
export interface SimulationScoring {
  readonly tamaraCoverageScore: number;
  readonly kaiScore: number;
  readonly jessyScore: number;
  readonly overallScore: number;
  readonly grade: Grade;
  readonly verdict: Verdict;
}

/** The full `simulations.result` JSONB payload once the pipeline finishes (or fails). */
export interface SimulationResult {
  readonly tamara: TamaraStageResult;
  readonly kai: KaiStageResult;
  readonly jessy: JessyStageResult;
  readonly scoring: SimulationScoring;
}

export interface SimulationLogEntry {
  readonly step: SimulationStep;
  readonly level: "INFO" | "WARN" | "ERROR";
  readonly message: string;
  readonly createdAt: string;
}

/** One full `simulations` row, domain-shaped (camelCase, dates as ISO strings). */
export interface StoredSimulation {
  readonly id: string;
  readonly tenantId: string;
  readonly objectiveSnapshot: Record<string, unknown>;
  readonly campaignDataSource: "cache" | "fresh";
  readonly personaIds: readonly string[];
  readonly branch?: string;
  readonly status: SimulationStatus;
  readonly currentStep: SimulationStep;
  readonly result?: SimulationResult;
  readonly errorMessage?: string;
  readonly decision?: SimulationDecision;
  readonly decidedBy?: string;
  readonly decisionNotes?: string;
  readonly decidedAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}
