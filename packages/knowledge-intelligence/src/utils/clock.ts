import type { IClock } from "../contracts/i-clock.js";

/** Default `IClock`: real wall-clock time. Used only at the outermost composition boundary. */
export class SystemClock implements IClock {
  now(): number {
    return Date.now();
  }
}

/**
 * Deterministic, manually-driven `IClock` for tests (and for any caller that wants fully
 * reproducible behavior). Never advances on its own — callers move time forward explicitly via
 * `advance()`/`set()`, keeping every time-dependent computation synchronous and reproducible.
 */
export class ManualClock implements IClock {
  private current: number;

  constructor(startAt = 0) {
    this.current = startAt;
  }

  now(): number {
    return this.current;
  }

  /** Moves the clock forward by `ms` (must be >= 0) and returns the new time. */
  advance(ms: number): number {
    if (ms < 0) {
      throw new RangeError("ManualClock.advance: ms must be >= 0");
    }
    this.current += ms;
    return this.current;
  }

  /** Sets the clock to an absolute epoch-millisecond timestamp. */
  set(timestamp: number): void {
    this.current = timestamp;
  }
}
