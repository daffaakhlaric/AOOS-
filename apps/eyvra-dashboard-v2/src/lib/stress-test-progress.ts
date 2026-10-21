/**
 * Creative Stress Test — per-evaluator progress + partial-result helpers. Pure, no JSX, no I/O.
 *
 * Progress is only ever read from what the backend persisted while `execute()` runs
 * (`result.kind === "IN_PROGRESS"`, or the final `progress` on a COMPLETED/PARTIAL result). A
 * QUEUED/RUNNING run without it (legacy, or the brief window before the first write) has NO
 * checklist — the UI keeps the generic "Sedang dievaluasi" text instead of inventing steps.
 */
import type {
  StressTestEvaluatedResultDto,
  StressTestPartialResultDto,
  StressTestProgressState,
  StressTestProgressStepDto,
  StressTestProgressStepKey,
  StressTestRunDto,
  StressTestRunProgressDto,
  StressTestStatus,
} from "@/lib/stress-test";

export const PROGRESS_STEP_LABELS: Record<StressTestProgressStepKey, string> = {
  PERSONA_SIMULATION: "Persona",
  COPY_EVALUATION: "Copy",
  FACT_VALIDATION: "Fact",
  OBJECTION_RESOLUTION: "Resolusi",
};

export const PROGRESS_STATE_LABELS: Record<StressTestProgressState, string> = {
  PENDING: "menunggu",
  RUNNING: "berjalan",
  DONE: "selesai",
  FAILED: "gagal",
  SKIPPED: "dilewati",
};

export const PROGRESS_STATE_ICON: Record<StressTestProgressState, string> = {
  PENDING: "…",
  RUNNING: "⟳",
  DONE: "✓",
  FAILED: "✕",
  SKIPPED: "–",
};

export function isInProgressStatus(status: StressTestStatus): boolean {
  return status === "QUEUED" || status === "RUNNING";
}

/** True while any of the given runs is QUEUED/RUNNING — the only condition under which the UI polls. */
export function shouldPollRuns(runs: readonly Pick<StressTestRunDto, "status">[]): boolean {
  return runs.some((r) => isInProgressStatus(r.status));
}

export const POLL_INTERVAL_MS = 3000;

/** The real persisted progress of a run, if any. */
export function progressOf(run: StressTestRunDto): StressTestRunProgressDto | undefined {
  const result = run.result;
  if (result === null) return undefined;
  if (result.kind === "IN_PROGRESS" || result.kind === "PARTIAL") return result.progress;
  if (result.kind === "COMPLETED") return result.progress;
  return undefined;
}

export interface ProgressStepView {
  readonly key: StressTestProgressStepKey;
  readonly state: StressTestProgressState;
  /** "Persona 3/5" / "Copy" / "Fact" / "Resolusi". */
  readonly label: string;
  readonly icon: string;
  readonly stateLabel: string;
}

export interface ProgressSummary {
  readonly steps: readonly ProgressStepView[];
  /** Steps that reached a terminal state (DONE/FAILED/SKIPPED). */
  readonly settled: number;
  readonly total: number;
  /** "Persona 3/5 ✓, Copy ✓, Fact berjalan — 2/4 evaluator". */
  readonly text: string;
}

function stepLabel(step: StressTestProgressStepDto): string {
  const base = PROGRESS_STEP_LABELS[step.key] ?? step.key;
  if (step.key === "PERSONA_SIMULATION" && step.total !== undefined && step.total > 0) {
    return `${base} ${String(step.done ?? 0)}/${String(step.total)}`;
  }
  return base;
}

export function summarizeProgress(progress: StressTestRunProgressDto): ProgressSummary {
  const steps = progress.steps.map((step): ProgressStepView => ({
    key: step.key,
    state: step.state,
    label: stepLabel(step),
    icon: PROGRESS_STATE_ICON[step.state],
    stateLabel: PROGRESS_STATE_LABELS[step.state],
  }));
  const settled = steps.filter(
    (s) => s.state === "DONE" || s.state === "FAILED" || s.state === "SKIPPED",
  ).length;
  const parts = steps.map((s) =>
    s.state === "DONE" || s.state === "FAILED" || s.state === "SKIPPED"
      ? `${s.label} ${s.icon}`
      : `${s.label} ${s.stateLabel}`,
  );
  return {
    steps,
    settled,
    total: steps.length,
    text: `${parts.join(", ")} — ${String(settled)}/${String(steps.length)} evaluator`,
  };
}

/* ------------------------------------------------------------------------------------------------
 * Partial results (FAILED runs)
 * --------------------------------------------------------------------------------------------- */

/** The partial result of a FAILED run that has at least one real evaluator output to show. */
export function partialResultOf(run: StressTestRunDto): StressTestPartialResultDto | undefined {
  if (run.status !== "FAILED" || run.result?.kind !== "PARTIAL") return undefined;
  return run.result.hasRealOutput ? run.result : undefined;
}

export const PARTIAL_NOT_FINISHED_NOTE = "Tidak selesai sebelum run gagal.";

/**
 * Adapter so the existing per-section components (persona section, objection table) can render a
 * partial result. Only fields those components read are meaningful; score/bucket/confidence are
 * deliberately `null`/`0` placeholders that the partial view NEVER renders (no ResultHero, no
 * readiness). Missing evaluators become honest "not finished" failures, never invented output.
 */
export function partialAsEvaluatedView(
  partial: StressTestPartialResultDto,
): StressTestEvaluatedResultDto {
  return {
    kind: "COMPLETED",
    personaCritiques: partial.personaCritiques,
    copyEvaluation: partial.copyEvaluation ?? {
      ok: false,
      failureReason: PARTIAL_NOT_FINISHED_NOTE,
    },
    factCheck: partial.factCheck ?? {
      status: "FAILED",
      note: PARTIAL_NOT_FINISHED_NOTE,
      findings: [],
    },
    dimensionScores: [],
    overallScore: null,
    scoreBucket: null,
    confidence: 0,
    primaryRecommendation: "",
    evaluatorsAttempted: partial.evaluatorsAttempted,
    evaluatorsSucceeded: partial.evaluatorsSucceeded,
    gaps: partial.gaps,
    ...(partial.objectionResolution !== undefined
      ? { objectionResolution: partial.objectionResolution }
      : {}),
    progress: partial.progress,
  };
}
