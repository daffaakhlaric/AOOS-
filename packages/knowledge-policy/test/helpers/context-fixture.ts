import { createKnowledgePolicyContext } from "../../src/context/create-knowledge-policy-context.js";
import type { KnowledgePolicyContext } from "../../src/context/knowledge-policy-context.js";

export function contextFixture(
  overrides: Partial<KnowledgePolicyContext> = {},
): KnowledgePolicyContext {
  return createKnowledgePolicyContext({
    tenantId: "tenant-1",
    workspaceId: "workspace-1",
    policyId: "policy-1",
    ...overrides,
  });
}
