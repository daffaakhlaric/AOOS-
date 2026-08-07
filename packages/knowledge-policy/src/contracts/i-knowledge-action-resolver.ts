import type { KnowledgePolicyAction } from "../domain/knowledge-policy-action.js";

/** Extension Point — interface only, no implementation in this package. */
export interface IKnowledgeActionResolver {
  execute(action: KnowledgePolicyAction, context: Readonly<Record<string, unknown>>): Promise<void>;
}
