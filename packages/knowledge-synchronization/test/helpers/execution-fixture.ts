import type { KnowledgeSynchronizationExecution } from "../../src/domain/knowledge-synchronization-execution.js";
import { KnowledgeSynchronizationState } from "../../src/domain/knowledge-synchronization-state.js";

import { contextFixture } from "./context-fixture.js";
import { jobFixture } from "./job-fixture.js";

export function executionFixture(
  overrides: Partial<KnowledgeSynchronizationExecution> = {},
): KnowledgeSynchronizationExecution {
  const now = new Date().toISOString();
  return {
    instance: {
      id: "instance-1",
      token: "stok_fixed",
      jobId: "job-1",
      providerId: "provider-1",
      tenantId: "tenant-1",
      workspaceId: "workspace-1",
      state: KnowledgeSynchronizationState.CREATED,
      retryCount: 0,
      changeCount: 0,
      createdAt: now,
      updatedAt: now,
    },
    context: contextFixture(),
    job: jobFixture(),
    changes: [],
    history: [],
    ...overrides,
  };
}
