import type { KnowledgeReview } from "../domain/knowledge-review.js";

/** "IKnowledgeReviewer — No implementation." (docs/PROMPT-005.7A-KNOWLEDGE-ENGINE.md — "AI READY: Knowledge Auto Review"). Implementation belongs to a future Engineering Task. */
export interface IKnowledgeReviewer {
  review(assetId: string): Promise<KnowledgeReview>;
}
