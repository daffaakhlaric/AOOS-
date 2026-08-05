export interface RetryState {
  readonly key: string;
  readonly attempt: number;
  readonly lastAttemptAt: string;
}

export interface RetryMetadata {
  readonly key: string;
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly delayMs: number;
}
