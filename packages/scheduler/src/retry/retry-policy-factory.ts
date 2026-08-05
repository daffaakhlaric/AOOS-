import type { RetryPolicyConfig } from "../contracts/retry-policy-config.js";
import type { IRetryPolicy } from "../contracts/retry-policy.js";
import { RetryStrategy } from "../contracts/retry-policy.js";

import { ExponentialBackoffPolicy } from "./exponential-backoff-policy.js";
import { LinearBackoffPolicy } from "./linear-backoff-policy.js";

/** Turns a storable `RetryPolicyConfig` (what a `JobRecord` persists) into a live `IRetryPolicy` (what `trigger/retry-trigger.ts` executes against). */
export function createRetryPolicy(config: RetryPolicyConfig): IRetryPolicy {
  if (config.strategy === RetryStrategy.EXPONENTIAL) {
    return new ExponentialBackoffPolicy(config.maxAttempts, config.baseDelayMs, config.maxDelayMs);
  }
  return new LinearBackoffPolicy(config.maxAttempts, config.baseDelayMs, config.maxDelayMs);
}
