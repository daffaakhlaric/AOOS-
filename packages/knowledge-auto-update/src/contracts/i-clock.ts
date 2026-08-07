/**
 * Injectable clock contract. All scheduling/staleness/backoff/retry logic in this package depends
 * on `IClock.now()` via constructor injection instead of calling `Date.now()` directly, and never
 * registers real `setTimeout`/`setInterval` callbacks — see `utils/clock.ts` for the real
 * (wall-clock) and manual (deterministic, test-only) implementations, and the scheduler's
 * `processDue(now)` / pipeline's explicit-tick model for how "the passage of time" is driven.
 */
export interface IClock {
  /** Current time as epoch milliseconds. */
  now(): number;
}
