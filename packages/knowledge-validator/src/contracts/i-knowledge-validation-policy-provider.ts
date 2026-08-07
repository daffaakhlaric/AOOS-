import type {
  KnowledgeValidationPolicyEvaluationInput,
  KnowledgeValidationPolicyEvaluationResult,
} from "../domain/knowledge-validation-policy.js";

/**
 * "IKnowledgeValidationPolicyProvider" (docs/PROMPT-005.7M-KNOWLEDGE-VALIDATOR.md —
 * "Extension Points") — interface ONLY. The seam through which a caller-supplied
 * `@aos/knowledge-policy` adapter can override the built-in
 * `evaluateKnowledgeValidationPolicy()` evaluation with a richer, externally-governed
 * policy engine.
 */
export interface IKnowledgeValidationPolicyProvider {
  evaluate(
    input: KnowledgeValidationPolicyEvaluationInput,
  ): Promise<KnowledgeValidationPolicyEvaluationResult>;
}
