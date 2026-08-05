import { EMPTY_KNOWLEDGE_SYNCHRONIZATION_STATISTICS } from "../domain/knowledge-synchronization-statistics-snapshot.js";
import type { KnowledgeSynchronizationStatisticsSnapshot } from "../domain/knowledge-synchronization-statistics-snapshot.js";

/** Builds a fresh, empty `KnowledgeSynchronizationStatisticsSnapshot`. */
export class SynchronizationStatisticsFactory {
  create(): KnowledgeSynchronizationStatisticsSnapshot {
    return { ...EMPTY_KNOWLEDGE_SYNCHRONIZATION_STATISTICS };
  }
}
