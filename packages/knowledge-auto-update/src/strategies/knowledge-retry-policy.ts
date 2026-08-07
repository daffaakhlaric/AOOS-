import type { RetryPolicyRules } from "../value-objects/knowledge-update-policy.js";

import { KnowledgeBackoffStrategy } from "./knowledge-backoff-strategy.js";

/** Combines `RetryPolicyRules` with `KnowledgeBackoffStrategy` to answer retry questions. */
export class KnowledgeRetryPolicy {
  private readonly backoff: KnowledgeBackoffStrategy;

  constructor(backoff: KnowledgeBackoffStrategy = new KnowledgeBackoffStrategy()) {
    this.backoff = backoff;
  }

  shouldRetry(attempt: number, retry: RetryPolicyRules): boolean {
    return attempt < retry.maxRetries;
  }

  nextAttemptDelay(attempt: number, retry: RetryPolicyRules): number {
    return this.backoff.computeDelay(attempt, retry);
  }
}
