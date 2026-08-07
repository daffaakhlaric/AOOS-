import type { KnowledgePolicyExecution } from "../../src/domain/knowledge-policy-execution.js";
import { KnowledgePolicyState } from "../../src/domain/knowledge-policy-state.js";

import { configurationFixture } from "./configuration-fixture.js";
import { contextFixture } from "./context-fixture.js";
import { metadataFixture } from "./metadata-fixture.js";

export function executionFixture(
  overrides: Partial<KnowledgePolicyExecution> = {},
): KnowledgePolicyExecution {
  const context = overrides.context ?? contextFixture();
  const metadata = overrides.metadata ?? metadataFixture();
  const configuration = overrides.configuration ?? configurationFixture();
  const now = "2026-01-01T00:00:00.000Z";
  return {
    instance: {
      id: "instance-1",
      token: context.token,
      policyId: metadata.policyId,
      tenantId: context.tenantId,
      workspaceId: context.workspaceId,
      state: KnowledgePolicyState.DRAFT,
      createdAt: now,
      updatedAt: now,
      ...overrides.instance,
    },
    context,
    metadata,
    configuration,
    rules: overrides.rules ?? [],
    scopes: overrides.scopes ?? [],
    assignments: overrides.assignments ?? [],
    history: overrides.history ?? [],
    trace: overrides.trace,
    auditTrail: overrides.auditTrail ?? [],
    logs: overrides.logs ?? [],
  };
}
