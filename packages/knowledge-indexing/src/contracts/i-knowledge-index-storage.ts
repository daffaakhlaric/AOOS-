import type { KnowledgeIndexEntry } from "../domain/knowledge-index-entry.js";

/** Interface only — no implementation in this package. `KnowledgeIndexRegistry` is in-memory only; a future durable backend would implement this to persist Index Entries across process restarts. */
export interface IKnowledgeIndexStorage {
  save(entry: KnowledgeIndexEntry): Promise<void>;
  load(id: string): Promise<KnowledgeIndexEntry | undefined>;
  delete(id: string): Promise<void>;
}
