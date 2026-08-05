import { IntegrationRetryExhaustedException } from "../errors/integration-retry-exhausted-exception.js";
import { SystemClock, type IClock } from "../utils/i-clock.js";

import { RetryStrategy, type RetryPolicy } from "./retry-policy.js";
import type { RetryMetadata, RetryState } from "./retry-state.js";

/** Computes per-attempt backoff and tracks Retry State per key (typically a namespace or Adapter name) — mirrors `@aos/workflow-execution`'s `RetryCoordinator` shape, applied here to one Integration attempt. */
export class RetryCoordinator {
  private readonly statesByKey = new Map<string, RetryState>();

  constructor(private readonly clock: IClock = new SystemClock()) {}

  computeDelayMs(policy: RetryPolicy, attempt: number): number {
    switch (policy.strategy) {
      case RetryStrategy.IMMEDIATE:
        return 0;
      case RetryStrategy.LINEAR:
        return (policy.baseDelayMs ?? 1000) * attempt;
      case RetryStrategy.EXPONENTIAL: {
        const raw = (policy.baseDelayMs ?? 1000) * 2 ** (attempt - 1);
        return Math.min(policy.maxDelayMs ?? 30_000, raw);
      }
      case RetryStrategy.CUSTOM:
        if (!policy.customDelayFn) {
          throw new IntegrationRetryExhaustedException(
            "RetryPolicy.strategy is CUSTOM but no customDelayFn was supplied",
          );
        }
        return policy.customDelayFn(attempt);
    }
  }

  /** Records the next attempt for `key`, throwing `IntegrationRetryExhaustedException` once `policy.maxAttempts` is exceeded. */
  recordAttempt(key: string, policy: RetryPolicy): RetryMetadata {
    const existing = this.statesByKey.get(key);
    const attempt = (existing?.attempt ?? 0) + 1;
    if (attempt > policy.maxAttempts) {
      throw new IntegrationRetryExhaustedException(
        `Key "${key}" exhausted its Retry Policy after ${policy.maxAttempts} attempt(s)`,
      );
    }
    const state: RetryState = {
      key,
      attempt,
      lastAttemptAt: new Date(this.clock.now()).toISOString(),
    };
    this.statesByKey.set(key, state);
    return {
      key,
      attempt,
      maxAttempts: policy.maxAttempts,
      delayMs: this.computeDelayMs(policy, attempt),
    };
  }

  getState(key: string): RetryState | undefined {
    return this.statesByKey.get(key);
  }

  reset(key: string): void {
    this.statesByKey.delete(key);
  }
}
