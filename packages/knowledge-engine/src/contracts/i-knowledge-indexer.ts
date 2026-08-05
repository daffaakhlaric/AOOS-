import type { KnowledgeAsset } from "../domain/knowledge-asset.js";

/** "IKnowledgeIndexer — No implementation." (docs/PROMPT-005.7A-KNOWLEDGE-ENGINE.md — "EXTENSION POINTS"). Implementation belongs to a future indexing/vector-search Engineering Task. */
export interface IKnowledgeIndexer {
  index(asset: KnowledgeAsset): Promise<void>;
  remove(assetId: string): Promise<void>;
}
