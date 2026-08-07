import type {
  KnowledgeGenerationPolicyEvaluationInput,
  KnowledgeGenerationPolicyEvaluationResult,
} from "../domain/knowledge-generation-policy.js";

/**
 * "IKnowledgeGenerationPolicy" (docs/PROMPT-005.7K-KNOWLEDGE-GENERATOR.md — "Extension
 * Points") — interface ONLY. The seam through which a caller-supplied
 * `@aos/knowledge-policy` adapter can override the built-in
 * `evaluateKnowledgeGenerationPolicy()` evaluation with a richer, externally-governed
 * policy engine.
 */
export interface IKnowledgeGenerationPolicy {
  evaluate(
    input: KnowledgeGenerationPolicyEvaluationInput,
  ): Promise<KnowledgeGenerationPolicyEvaluationResult>;
}
