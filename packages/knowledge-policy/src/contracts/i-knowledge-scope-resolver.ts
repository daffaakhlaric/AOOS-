import type { KnowledgePolicyScope } from "../domain/knowledge-policy-scope.js";

/** Extension Point — interface only, no implementation in this package. */
export interface IKnowledgeScopeResolver {
  resolve(scope: KnowledgePolicyScope): Promise<readonly string[]>;
}
