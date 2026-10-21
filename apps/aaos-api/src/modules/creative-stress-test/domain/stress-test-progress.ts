import type {
  StressTestProgressState,
  StressTestProgressStep,
  StressTestProgressStepKey,
  StressTestRunProgress,
} from "./stress-test-run.js";

/**
 * Creative Stress Test — per-evaluator progress for a running `execute()`.
 *
 * Step order is fixed (the dashboard renders it as-is): persona simulation -> copy evaluator ->
 * fact validator -> objection resolution. Every mutation produces ONE persisted write (via the
 * injected `write`), and writes are strictly serialized on a promise chain: each queued write
 * persists the tracker's LATEST snapshot at the moment it runs, so a slow earlier write can never
 * land after (and overwrite) a newer state. `flush()` must be awaited before the terminal
 * `markCompleted`/`markFailed` write so no progress write can clobber the final result.
 *
 * Progress writes are best-effort: a failed write is logged via `onWriteError` and never fails the
 * run (the evaluators' real output matters more than the checklist).
 */
export const PROGRESS_STEP_ORDER: readonly StressTestProgressStepKey[] = [
  "PERSONA_SIMULATION",
  "COPY_EVALUATION",
  "FACT_VALIDATION",
  "OBJECTION_RESOLUTION",
];

export function initialProgressSteps(personaTotal: number): readonly StressTestProgressStep[] {
  return [
    personaTotal > 0
      ? { key: "PERSONA_SIMULATION", state: "RUNNING", done: 0, total: personaTotal, failed: 0 }
      : { key: "PERSONA_SIMULATION", state: "SKIPPED", done: 0, total: 0, failed: 0 },
    { key: "COPY_EVALUATION", state: "RUNNING" },
    { key: "FACT_VALIDATION", state: "RUNNING" },
    { key: "OBJECTION_RESOLUTION", state: "PENDING" },
  ];
}

export class StressTestProgressTracker {
  private steps: StressTestProgressStep[];
  private chain: Promise<void> = Promise.resolve();

  constructor(
    personaTotal: number,
    private readonly write: (progress: StressTestRunProgress) => Promise<void>,
    private readonly now: () => Date,
    private readonly onWriteError: (error: unknown) => void = () => undefined,
  ) {
    this.steps = [...initialProgressSteps(personaTotal)];
  }

  snapshot(): StressTestRunProgress {
    return { steps: this.steps.map((s) => ({ ...s })), updatedAt: this.now().toISOString() };
  }

  /**
   * Terminal snapshot after an unexpected error (NOT persisted on its own — it becomes part of the
   * partial result): steps still RUNNING never finished -> FAILED; steps still PENDING never
   * started -> SKIPPED.
   */
  finalSnapshot(): StressTestRunProgress {
    const steps = this.steps.map((s): StressTestProgressStep => {
      if (s.state === "RUNNING") return { ...s, state: "FAILED" };
      if (s.state === "PENDING") return { ...s, state: "SKIPPED" };
      return { ...s };
    });
    return { steps, updatedAt: this.now().toISOString() };
  }

  /** Records one persona settling. The step becomes DONE when all settled and ≥1 succeeded, FAILED when all failed. */
  personaSettled(ok: boolean): void {
    this.update("PERSONA_SIMULATION", (step) => {
      const total = step.total ?? 0;
      const done = Math.min(total, (step.done ?? 0) + 1);
      const failed = (step.failed ?? 0) + (ok ? 0 : 1);
      const state: StressTestProgressState =
        done < total ? "RUNNING" : failed >= total ? "FAILED" : "DONE";
      return { ...step, done, failed, state };
    });
  }

  set(key: StressTestProgressStepKey, state: StressTestProgressState): void {
    this.update(key, (step) => ({ ...step, state }));
  }

  /** Resolves once every queued write has settled. */
  async flush(): Promise<void> {
    await this.chain;
  }

  private update(
    key: StressTestProgressStepKey,
    fn: (step: StressTestProgressStep) => StressTestProgressStep,
  ): void {
    this.steps = this.steps.map((s) => (s.key === key ? fn(s) : s));
    this.chain = this.chain.then(async () => {
      try {
        await this.write(this.snapshot());
      } catch (error) {
        this.onWriteError(error);
      }
    });
  }
}
