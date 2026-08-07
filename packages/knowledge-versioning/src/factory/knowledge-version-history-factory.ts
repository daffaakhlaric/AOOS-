import { KnowledgeHistory } from "../domain/knowledge-history.js";

/** Builds a fresh, empty `KnowledgeHistory` aggregate for a given version. */
export class KnowledgeVersionHistoryFactory {
  create(versionId: string): KnowledgeHistory {
    return new KnowledgeHistory(versionId);
  }
}
