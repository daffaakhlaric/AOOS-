import type { KnowledgeSourceExecution } from "../../src/domain/knowledge-source-execution.js";
import { KnowledgeSourceState } from "../../src/domain/knowledge-source-state.js";

import { configurationFixture } from "./configuration-fixture.js";
import { contextFixture } from "./context-fixture.js";
import { metadataFixture } from "./metadata-fixture.js";

export function executionFixture(
  overrides: Partial<KnowledgeSourceExecution> = {},
): KnowledgeSourceExecution {
  const now = new Date().toISOString();
  return {
    instance: {
      id: "instance-1",
      token: "ksrc_fixed",
      sourceId: "source-1",
      providerId: "provider-1",
      tenantId: "tenant-1",
      workspaceId: "workspace-1",
      state: KnowledgeSourceState.CREATED,
      createdAt: now,
      updatedAt: now,
    },
    context: contextFixture(),
    metadata: metadataFixture(),
    configuration: configurationFixture(),
    history: [],
    ...overrides,
  };
}
