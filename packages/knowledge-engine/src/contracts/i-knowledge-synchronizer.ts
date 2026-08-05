import type { KnowledgeSource } from "../domain/knowledge-source.js";

/** "IKnowledgeSynchronizer — No implementation." (docs/PROMPT-005.7A-KNOWLEDGE-ENGINE.md — "EXTENSION POINTS"). Implementation belongs to a future external-source synchronization Engineering Task. */
export interface IKnowledgeSynchronizer {
  synchronize(source: KnowledgeSource): Promise<void>;
}
