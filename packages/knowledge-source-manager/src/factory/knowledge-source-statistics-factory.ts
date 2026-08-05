import { EMPTY_KNOWLEDGE_SOURCE_STATISTICS } from "../domain/knowledge-source-statistics-snapshot.js";
import type { KnowledgeSourceStatisticsSnapshot } from "../domain/knowledge-source-statistics-snapshot.js";

/** Builds a fresh, empty `KnowledgeSourceStatisticsSnapshot`. */
export class KnowledgeSourceStatisticsFactory {
  create(): KnowledgeSourceStatisticsSnapshot {
    return { ...EMPTY_KNOWLEDGE_SOURCE_STATISTICS };
  }
}
