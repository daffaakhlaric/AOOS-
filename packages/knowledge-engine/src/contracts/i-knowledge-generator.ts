import type { KnowledgeAsset } from "../domain/knowledge-asset.js";

/** "IKnowledgeGenerator — No implementation." (docs/PROMPT-005.7A-KNOWLEDGE-ENGINE.md — "AI READY"). Implementation belongs to a future AI Gateway / generation Engineering Task. */
export interface IKnowledgeGenerator {
  generate(prompt: string): Promise<Partial<KnowledgeAsset>>;
}
