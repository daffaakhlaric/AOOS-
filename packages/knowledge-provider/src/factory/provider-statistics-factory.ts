import { EMPTY_KNOWLEDGE_PROVIDER_STATISTICS } from "../domain/knowledge-provider-statistics-snapshot.js";
import type { KnowledgeProviderStatisticsSnapshot } from "../domain/knowledge-provider-statistics-snapshot.js";

/** Builds a fresh, empty `KnowledgeProviderStatisticsSnapshot`. */
export class ProviderStatisticsFactory {
  create(): KnowledgeProviderStatisticsSnapshot {
    return { ...EMPTY_KNOWLEDGE_PROVIDER_STATISTICS };
  }
}
