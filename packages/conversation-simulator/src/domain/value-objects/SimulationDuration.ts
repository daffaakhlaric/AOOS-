/** Elapsed wall-clock time for one simulation run, in milliseconds (spec "domain/value-objects/SimulationDuration.ts"). Always measured against real `Date.now()`, never the injectable Clara clock — it answers "how long did this simulation take to execute", not "how much in-story time passed". */
export class SimulationDuration {
  private constructor(private readonly ms: number) {}

  static zero(): SimulationDuration {
    return new SimulationDuration(0);
  }

  static of(ms: number): SimulationDuration {
    if (!Number.isFinite(ms) || ms < 0) {
      throw new RangeError(`SimulationDuration must be a non-negative finite number, got ${ms}`);
    }
    return new SimulationDuration(ms);
  }

  static between(startMs: number, endMs: number): SimulationDuration {
    return SimulationDuration.of(Math.max(0, endMs - startMs));
  }

  toMillis(): number {
    return this.ms;
  }

  exceeds(budgetMs: number): boolean {
    return this.ms > budgetMs;
  }
}
