/** "Retry State. Retry Count. Retry Metadata." (docs/PROMPT-005.6D-WORKFLOW-EXECUTION-ENGINE.md). */
export interface RetryState {
  readonly nodeId: string;
  readonly attempt: number;
  readonly lastAttemptAt: string;
}

export interface RetryMetadata {
  readonly nodeId: string;
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly delayMs: number;
}
