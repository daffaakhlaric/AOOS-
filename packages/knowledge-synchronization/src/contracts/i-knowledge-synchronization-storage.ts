import type { KnowledgeSynchronizationExecution } from "../domain/knowledge-synchronization-execution.js";

/** Interface only — no implementation in this package. Persists a completed Synchronization's committed state — this package never writes to any storage backend itself. */
export interface IKnowledgeSynchronizationStorage {
  readonly id: string;
  persist(execution: KnowledgeSynchronizationExecution): Promise<void>;
}
