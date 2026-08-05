/** Retry Policy Interface (docs/PROMPT-005.5-ENTERPRISE-SCHEDULER.md — "Retry"). */
export enum RetryStrategy {
  EXPONENTIAL = "exponential",
  LINEAR = "linear",
}

/** Retry Metadata — attached to a Job so the Retry Queue/Trigger can see retry history. */
export interface RetryMetadata {
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly lastError?: string;
  readonly nextRetryAt?: string;
}

export interface IRetryPolicy {
  readonly strategy: RetryStrategy;
  readonly maxAttempts: number;
  /** Delay in milliseconds before the given (1-indexed) attempt number. */
  nextDelayMs(attempt: number): number;
}
