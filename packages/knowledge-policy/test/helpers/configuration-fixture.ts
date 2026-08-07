import type { KnowledgePolicyConfigurationRecord } from "../../src/domain/knowledge-policy-configuration-record.js";

export function configurationFixture(
  overrides: Partial<KnowledgePolicyConfigurationRecord> = {},
): KnowledgePolicyConfigurationRecord {
  return {
    policyId: "policy-1",
    enforceMode: "permissive",
    allowOverride: false,
    ...overrides,
  };
}
