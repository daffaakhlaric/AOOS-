import { RetryStrategy, type IRetryPolicy } from "../contracts/retry-policy.js";

/** Exponential Backoff — delay doubles each attempt, capped at `maxDelayMs`. */
export class ExponentialBackoffPolicy implements IRetryPolicy {
  readonly strategy = RetryStrategy.EXPONENTIAL;

  constructor(
    readonly maxAttempts: number = 5,
    private readonly baseDelayMs: number = 100,
    private readonly maxDelayMs: number = 30_000,
  ) {}

  nextDelayMs(attempt: number): number {
    const delay = this.baseDelayMs * 2 ** Math.max(0, attempt - 1);
    return Math.min(delay, this.maxDelayMs);
  }
}
