import type { KnowledgeEmbeddingReference } from "../domain/knowledge-embedding-reference.js";

/** Interface only — no implementation in this package. "Never generate embeddings. Only store references." A future provider would generate the real embedding and hand back a reference for this package to store. */
export interface IKnowledgeEmbeddingProvider {
  describe(assetId: string): Promise<KnowledgeEmbeddingReference | undefined>;
}
