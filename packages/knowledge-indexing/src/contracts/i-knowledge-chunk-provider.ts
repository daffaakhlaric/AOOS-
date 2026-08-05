import type { KnowledgeChunkReference } from "../domain/knowledge-chunk-reference.js";

/** Interface only — no implementation in this package. "Do NOT chunk documents. Store ONLY chunk references. Chunking belongs to future Retrieval." */
export interface IKnowledgeChunkProvider {
  listChunkReferences(assetId: string): Promise<readonly KnowledgeChunkReference[]>;
}
