import type { KnowledgeResult } from "../domain/knowledge-result.js";

/** Interface only — no implementation in this package. "No Vector Database." A future provider queries a vector store by a caller-supplied embedding vector and returns matching Results. */
export interface IKnowledgeVectorSearchProvider {
  searchByVector(vector: readonly number[], limit: number): Promise<readonly KnowledgeResult[]>;
}
