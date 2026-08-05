import type { KnowledgeSynchronizationExecution } from "../domain/knowledge-synchronization-execution.js";

/** Interface only — no implementation in this package. Decides whether a Failed Synchronization should transition to Retrying, and how long to wait first. */
export interface IKnowledgeSynchronizationRetryStrategy {
  readonly id: string;
  shouldRetry(execution: KnowledgeSynchronizationExecution, error: unknown): boolean;
  nextDelayMs(attempt: number): number;
}
