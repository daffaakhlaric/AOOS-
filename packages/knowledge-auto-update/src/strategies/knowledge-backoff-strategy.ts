import { computeExponentialBackoffDelay } from "../utils/backoff.js";
import type { RetryPolicyRules } from "../value-objects/knowledge-update-policy.js";

/**
 * Real exponential backoff: `retryDelayMs * backoffMultiplier^attempt`, capped at
 * `maxBackoffDelayMs`. No jitter by default (fully deterministic); callers may supply a pure
 * jitter function.
 */
export class KnowledgeBackoffStrategy {
  private readonly jitter?: (delayMs: number) => number;

  constructor(jitter?: (delayMs: number) => number) {
    this.jitter = jitter;
  }

  computeDelay(attempt: number, retry: RetryPolicyRules): number {
    return computeExponentialBackoffDelay(attempt, {
      baseDelayMs: retry.retryDelayMs,
      multiplier: retry.backoffMultiplier,
      maxDelayMs: retry.maxBackoffDelayMs,
      jitter: this.jitter,
    });
  }
}
