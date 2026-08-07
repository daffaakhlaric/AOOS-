import type { KnowledgePolicyEvaluation } from "../domain/knowledge-policy-evaluation.js";

/** Extension Point — interface only, no implementation in this package. */
export interface IKnowledgePolicyEvaluator {
  evaluate(policyId: string, targetId: string): Promise<KnowledgePolicyEvaluation>;
}
