import type { KnowledgeAsset } from "../domain/knowledge-asset.js";

export interface KnowledgeRetrievalQuery {
  readonly text: string;
  readonly limit?: number;
}

/** "IKnowledgeRetriever — No implementation." (docs/PROMPT-005.7A-KNOWLEDGE-ENGINE.md — "EXTENSION POINTS"). Implementation belongs to a future RAG/retrieval Engineering Task. */
export interface IKnowledgeRetriever {
  retrieve(query: KnowledgeRetrievalQuery): Promise<readonly KnowledgeAsset[]>;
}
