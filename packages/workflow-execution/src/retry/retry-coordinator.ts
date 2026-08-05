import { RetryExhaustedException } from "../errors/retry-exhausted-exception.js";
import { SystemClock, type IClock } from "../utils/i-clock.js";

import { RetryStrategy, type RetryPolicy } from "./retry-policy.js";
import type { RetryMetadata, RetryState } from "./retry-state.js";

/** Computes per-attempt backoff and tracks Retry State per Node id — mirrors the shape (not the code) of `@aos/scheduler`'s Job-level retry policies, applied here to Node-level retries within one Execution Session. */
export class RetryCoordinator {
  private readonly statesByNodeId = new Map<string, RetryState>();

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
          throw new RetryExhaustedException(
            "RetryPolicy.strategy is CUSTOM but no customDelayFn was supplied",
          );
        }
        return policy.customDelayFn(attempt);
    }
  }

  /** Records the next attempt for `nodeId`, throwing `RetryExhaustedException` once `policy.maxAttempts` is exceeded. */
  recordAttempt(nodeId: string, policy: RetryPolicy): RetryMetadata {
    const existing = this.statesByNodeId.get(nodeId);
    const attempt = (existing?.attempt ?? 0) + 1;
    if (attempt > policy.maxAttempts) {
      throw new RetryExhaustedException(
        `Node "${nodeId}" exhausted its Retry Policy after ${policy.maxAttempts} attempt(s)`,
      );
    }
    const state: RetryState = {
      nodeId,
      attempt,
      lastAttemptAt: new Date(this.clock.now()).toISOString(),
    };
    this.statesByNodeId.set(nodeId, state);
    return {
      nodeId,
      attempt,
      maxAttempts: policy.maxAttempts,
      delayMs: this.computeDelayMs(policy, attempt),
    };
  }

  getState(nodeId: string): RetryState | undefined {
    return this.statesByNodeId.get(nodeId);
  }

  reset(nodeId: string): void {
    this.statesByNodeId.delete(nodeId);
  }
}
