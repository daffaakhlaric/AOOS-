import { KnowledgePolicyScopeType } from "../../src/domain/knowledge-policy-scope-type.js";
import type { KnowledgePolicyScope } from "../../src/domain/knowledge-policy-scope.js";

export function scopeFixture(overrides: Partial<KnowledgePolicyScope> = {}): KnowledgePolicyScope {
  return {
    id: "scope-1",
    policyId: "policy-1",
    scopeType: KnowledgePolicyScopeType.GLOBAL,
    metadata: {},
    ...overrides,
  };
}
