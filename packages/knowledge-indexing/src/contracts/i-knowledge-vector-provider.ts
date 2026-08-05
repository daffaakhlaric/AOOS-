/** Interface only — no implementation in this package. "No Vector DB implementation." A future provider would store/query vectors keyed by `embeddingId`. */
export interface IKnowledgeVectorProvider {
  upsert(embeddingId: string, vector: readonly number[]): Promise<void>;
  remove(embeddingId: string): Promise<void>;
}
