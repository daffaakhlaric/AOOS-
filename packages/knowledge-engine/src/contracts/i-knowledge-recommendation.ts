import type { KnowledgeAsset } from "../domain/knowledge-asset.js";

/** "IKnowledgeRecommendation — No implementation." (docs/PROMPT-005.7A-KNOWLEDGE-ENGINE.md — "AI READY: Knowledge Recommendation"). Implementation belongs to a future Engineering Task. */
export interface IKnowledgeRecommendation {
  recommend(assetId: string, limit?: number): Promise<readonly KnowledgeAsset[]>;
}
