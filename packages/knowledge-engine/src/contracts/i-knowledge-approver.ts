import type { KnowledgeApproval } from "../domain/knowledge-review.js";

/** "IKnowledgeApprover — No implementation." (docs/PROMPT-005.7A-KNOWLEDGE-ENGINE.md — "AI READY: Knowledge Auto Review"). Implementation belongs to a future Engineering Task. */
export interface IKnowledgeApprover {
  approve(assetId: string, approverId: string): Promise<KnowledgeApproval>;
}
