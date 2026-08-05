import { RetryStrategy, type IRetryPolicy } from "../contracts/retry-policy.js";

/** Linear Backoff — delay grows by a fixed increment each attempt, capped at `maxDelayMs`. */
export class LinearBackoffPolicy implements IRetryPolicy {
  readonly strategy = RetryStrategy.LINEAR;

  constructor(
    readonly maxAttempts: number = 5,
    private readonly incrementMs: number = 100,
    private readonly maxDelayMs: number = 30_000,
  ) {}

  nextDelayMs(attempt: number): number {
    const delay = this.incrementMs * Math.max(1, attempt);
    return Math.min(delay, this.maxDelayMs);
  }
}
