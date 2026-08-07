import type { KnowledgeGenerationResult } from "../domain/knowledge-generation-result.js";

/**
 * "FUTURE READINESS: Prepare interface-only contracts for 005.7L Knowledge Quality
 * Engine ... No implementation." (docs/PROMPT-005.7K-KNOWLEDGE-GENERATOR.md) — the seam
 * a future `@aos/knowledge-quality-engine` (005.7L) will implement to score a completed
 * `KnowledgeGenerationResult`. Never implemented in this package.
 */
export interface IKnowledgeQualityEngineGenerator {
  scoreResult(result: KnowledgeGenerationResult): Promise<number>;
}
