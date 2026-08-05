import type { KnowledgeSynchronizationExecution } from "../domain/knowledge-synchronization-execution.js";

/** Interface only — no implementation in this package. Observes every Synchronization state transition, independent of the Event Bus. */
export interface IKnowledgeSynchronizationObserver {
  readonly id: string;
  onTransition(execution: KnowledgeSynchronizationExecution): void | Promise<void>;
}
