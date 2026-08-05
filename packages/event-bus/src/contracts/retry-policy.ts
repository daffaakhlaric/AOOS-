/** Retry Policy Interface (docs/PROMPT-005.4-ENTERPRISE-EVENT-BUS.md — "Retry"). */
export enum RetryStrategy {
  EXPONENTIAL = "exponential",
  LINEAR = "linear",
}

/** Retry Metadata — attached to a delivery attempt so subscribers/DLQ/tracing can see retry history. */
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
