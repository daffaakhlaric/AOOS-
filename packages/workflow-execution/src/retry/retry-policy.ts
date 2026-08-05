/** "RETRY: Support Immediate, Linear, Exponential, Custom Policy." (docs/PROMPT-005.6D-WORKFLOW-EXECUTION-ENGINE.md). */
export enum RetryStrategy {
  IMMEDIATE = "immediate",
  LINEAR = "linear",
  EXPONENTIAL = "exponential",
  CUSTOM = "custom",
}

export interface RetryPolicy {
  readonly strategy: RetryStrategy;
  readonly maxAttempts: number;
  readonly baseDelayMs?: number;
  readonly maxDelayMs?: number;
  /** Required when `strategy === RetryStrategy.CUSTOM` — computes the delay before attempt `attempt` (1-indexed). */
  readonly customDelayFn?: (attempt: number) => number;
}
