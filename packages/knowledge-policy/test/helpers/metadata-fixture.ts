import type { KnowledgePolicyMetadata } from "../../src/domain/knowledge-policy-metadata.js";
import { KnowledgePolicyType } from "../../src/domain/knowledge-policy-type.js";

export function metadataFixture(
  overrides: Partial<KnowledgePolicyMetadata> = {},
): KnowledgePolicyMetadata {
  const now = "2026-01-01T00:00:00.000Z";
  return {
    policyId: "policy-1",
    policyName: "Test Policy",
    policyType: KnowledgePolicyType.ACCESS,
    priority: 0,
    tenantId: "tenant-1",
    workspaceId: "workspace-1",
    labels: [],
    tags: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
