import type { KnowledgeSynchronizationJobType } from "../domain/knowledge-synchronization-job-type.js";
import type { KnowledgeSynchronizationJob } from "../domain/knowledge-synchronization-job.js";
import type { KnowledgeSynchronizationMode } from "../domain/knowledge-synchronization-mode.js";
import { generateId } from "../utils/id.js";

export interface CreateSynchronizationJobInput {
  readonly type: KnowledgeSynchronizationJobType;
  readonly mode: KnowledgeSynchronizationMode;
  readonly providerId: string;
  readonly sourceId: string;
  readonly tenantId: string;
  readonly workspaceId?: string;
  readonly collection?: string;
  readonly namespace?: string;
}

/** Builds a fresh `KnowledgeSynchronizationJob`. */
export class SynchronizationJobFactory {
  create(input: CreateSynchronizationJobInput): KnowledgeSynchronizationJob {
    return {
      id: generateId(),
      type: input.type,
      mode: input.mode,
      providerId: input.providerId,
      sourceId: input.sourceId,
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      collection: input.collection,
      namespace: input.namespace,
      createdAt: new Date().toISOString(),
    };
  }
}
