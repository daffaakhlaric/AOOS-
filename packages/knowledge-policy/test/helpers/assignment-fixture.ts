import type { KnowledgePolicyAssignment } from "../../src/domain/knowledge-policy-assignment.js";

export function assignmentFixture(
  overrides: Partial<KnowledgePolicyAssignment> = {},
): KnowledgePolicyAssignment {
  return {
    id: "assignment-1",
    policyId: "policy-1",
    targetType: "workspace",
    targetId: "workspace-1",
    priority: 0,
    assignedAt: "2026-01-01T00:00:00.000Z",
    metadata: {},
    ...overrides,
  };
}
