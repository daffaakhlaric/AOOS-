import type {
  KnowledgeQualityPolicyEvaluationInput,
  KnowledgeQualityPolicyEvaluationResult,
} from "../domain/knowledge-quality-policy.js";

/**
 * "IKnowledgeQualityPolicyProvider" (docs/PROMPT-005.7L-KNOWLEDGE-QUALITY.md —
 * "Extension Points") — interface ONLY. The seam through which a caller-supplied
 * `@aos/knowledge-policy` adapter can override the built-in
 * `evaluateKnowledgeQualityPolicy()` evaluation with a richer, externally-governed
 * policy engine.
 */
export interface IKnowledgeQualityPolicyProvider {
  evaluate(
    input: KnowledgeQualityPolicyEvaluationInput,
  ): Promise<KnowledgeQualityPolicyEvaluationResult>;
}
