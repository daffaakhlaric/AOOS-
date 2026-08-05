import type { KnowledgeProviderExecution } from "../../src/domain/knowledge-provider-execution.js";
import { KnowledgeProviderState } from "../../src/domain/knowledge-provider-state.js";

import { contextFixture } from "./context-fixture.js";
import { metadataFixture } from "./metadata-fixture.js";

export function executionFixture(
  overrides: Partial<KnowledgeProviderExecution> = {},
): KnowledgeProviderExecution {
  const now = new Date().toISOString();
  return {
    instance: {
      id: "instance-1",
      token: "ptok_fixed",
      providerId: "provider-1",
      tenantId: "tenant-1",
      workspaceId: "workspace-1",
      state: KnowledgeProviderState.REGISTERED,
      createdAt: now,
      updatedAt: now,
    },
    context: contextFixture(),
    metadata: metadataFixture(),
    history: [],
    ...overrides,
  };
}
