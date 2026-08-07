import type { KnowledgeGenerationResult } from "../domain/knowledge-generation-result.js";

/**
 * "FUTURE READINESS: Prepare interface-only contracts for ... 005.7M Knowledge
 * Validator AI ... No implementation." (docs/PROMPT-005.7K-KNOWLEDGE-GENERATOR.md) —
 * the seam a future `@aos/knowledge-validator-ai` (005.7M) will implement to validate a
 * completed `KnowledgeGenerationResult`. Never implemented in this package.
 */
export interface IKnowledgeValidatorAiGenerator {
  validateResult(result: KnowledgeGenerationResult): Promise<boolean>;
}
