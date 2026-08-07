import type { KnowledgeVersionExecution } from "../../src/domain/knowledge-version-execution.js";
import { KnowledgeVersionState } from "../../src/domain/knowledge-version-state.js";

import { configurationFixture } from "./configuration-fixture.js";
import { contextFixture } from "./context-fixture.js";
import { metadataFixture } from "./metadata-fixture.js";

export function executionFixture(
  overrides: Partial<KnowledgeVersionExecution> = {},
): KnowledgeVersionExecution {
  const context = overrides.context ?? contextFixture();
  const metadata = overrides.metadata ?? metadataFixture();
  const configuration = overrides.configuration ?? configurationFixture();
  const now = "2026-01-01T00:00:00.000Z";
  return {
    instance: {
      id: "instance-1",
      token: context.token,
      versionId: metadata.versionId,
      assetId: metadata.assetId,
      tenantId: context.tenantId,
      workspaceId: context.workspaceId,
      state: KnowledgeVersionState.DRAFT,
      createdAt: now,
      updatedAt: now,
      ...overrides.instance,
    },
    context,
    metadata,
    configuration,
    history: overrides.history ?? [],
    trace: overrides.trace,
    auditTrail: overrides.auditTrail ?? [],
    logs: overrides.logs ?? [],
  };
}
