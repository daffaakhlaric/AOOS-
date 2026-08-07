import type { KnowledgePolicyCondition } from "../domain/knowledge-policy-condition.js";

/** Extension Point — interface only, no implementation in this package. */
export interface IKnowledgeConditionResolver {
  resolve(
    condition: KnowledgePolicyCondition,
    context: Readonly<Record<string, unknown>>,
  ): Promise<boolean>;
}
