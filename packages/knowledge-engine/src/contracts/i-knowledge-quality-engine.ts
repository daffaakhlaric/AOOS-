export interface KnowledgeQualityScore {
  readonly assetId: string;
  readonly score: number;
  readonly issues: readonly string[];
}

/** "IKnowledgeQualityEngine — No implementation." (docs/PROMPT-005.7A-KNOWLEDGE-ENGINE.md — "AI READY: Knowledge Quality, Knowledge Quality Score"). Implementation belongs to a future Engineering Task. */
export interface IKnowledgeQualityEngine {
  score(assetId: string): Promise<KnowledgeQualityScore>;
}
