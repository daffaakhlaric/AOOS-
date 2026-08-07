/** Pure inputs for exponential backoff delay computation. */
export interface BackoffOptions {
  /** Delay before the first retry (attempt 0), in milliseconds. Must be >= 0. */
  readonly baseDelayMs: number;
  /** Multiplier applied per attempt. Must be >= 1. Defaults to 2 (classic doubling). */
  readonly multiplier?: number;
  /** Optional cap on the computed delay, in milliseconds. */
  readonly maxDelayMs?: number;
  /**
   * Optional deterministic jitter function receiving the un-jittered delay and returning the
   * final delay. No jitter is applied by default (fully deterministic). Callers wanting jitter
   * must supply a pure, seeded function — this package never uses `Math.random()`.
   */
  readonly jitter?: (delayMs: number) => number;
}

/**
 * Computes `baseDelayMs * multiplier^attempt`, capped at `maxDelayMs` if provided, then passed
 * through `jitter` if provided. Pure function — `attempt` is 0-based (0 = first retry).
 */
export function computeExponentialBackoffDelay(attempt: number, options: BackoffOptions): number {
  if (!Number.isInteger(attempt) || attempt < 0) {
    throw new RangeError("computeExponentialBackoffDelay: attempt must be a non-negative integer");
  }
  if (options.baseDelayMs < 0) {
    throw new RangeError("computeExponentialBackoffDelay: baseDelayMs must be >= 0");
  }
  const multiplier = options.multiplier ?? 2;
  if (multiplier < 1) {
    throw new RangeError("computeExponentialBackoffDelay: multiplier must be >= 1");
  }

  let delay = options.baseDelayMs * multiplier ** attempt;
  if (options.maxDelayMs !== undefined) {
    delay = Math.min(delay, options.maxDelayMs);
  }
  if (options.jitter) {
    delay = options.jitter(delay);
  }
  return delay;
}
