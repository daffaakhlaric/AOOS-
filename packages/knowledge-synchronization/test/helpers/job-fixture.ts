import { KnowledgeSynchronizationJobType } from "../../src/domain/knowledge-synchronization-job-type.js";
import type { KnowledgeSynchronizationJob } from "../../src/domain/knowledge-synchronization-job.js";
import { KnowledgeSynchronizationMode } from "../../src/domain/knowledge-synchronization-mode.js";

export function jobFixture(
  overrides: Partial<KnowledgeSynchronizationJob> = {},
): KnowledgeSynchronizationJob {
  return {
    id: "job-1",
    type: KnowledgeSynchronizationJobType.MANUAL_SYNC,
    mode: KnowledgeSynchronizationMode.MANUAL,
    providerId: "provider-1",
    sourceId: "source-1",
    tenantId: "tenant-1",
    workspaceId: "workspace-1",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}
