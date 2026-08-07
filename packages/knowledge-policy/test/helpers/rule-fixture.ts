import { KnowledgePolicyRuleType } from "../../src/domain/knowledge-policy-rule-type.js";
import type { KnowledgePolicyRule } from "../../src/domain/knowledge-policy-rule.js";

export function ruleFixture(overrides: Partial<KnowledgePolicyRule> = {}): KnowledgePolicyRule {
  return {
    id: "rule-1",
    policyId: "policy-1",
    name: "Test Rule",
    ruleType: KnowledgePolicyRuleType.ALLOW,
    priority: 0,
    conditions: [],
    actions: [],
    enabled: true,
    metadata: {},
    ...overrides,
  };
}
