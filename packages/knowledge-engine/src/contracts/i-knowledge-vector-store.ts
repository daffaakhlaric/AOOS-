export interface KnowledgeVectorMatch {
  readonly assetId: string;
  readonly score: number;
}

/** "IKnowledgeVectorStore — No implementation." (docs/PROMPT-005.7A-KNOWLEDGE-ENGINE.md — "EXTENSION POINTS"). Implementation belongs to a future vector-search Engineering Task. */
export interface IKnowledgeVectorStore {
  upsert(assetId: string, vector: readonly number[]): Promise<void>;
  query(vector: readonly number[], limit: number): Promise<readonly KnowledgeVectorMatch[]>;
  remove(assetId: string): Promise<void>;
}
