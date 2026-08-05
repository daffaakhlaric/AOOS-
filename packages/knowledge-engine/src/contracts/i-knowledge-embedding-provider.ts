/** "IKnowledgeEmbeddingProvider — No implementation." (docs/PROMPT-005.7A-KNOWLEDGE-ENGINE.md — "EXTENSION POINTS"). Implementation belongs to a future AI Gateway / Embedding Engineering Task. */
export interface IKnowledgeEmbeddingProvider {
  embed(text: string): Promise<readonly number[]>;
}
