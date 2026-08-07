import type { KnowledgeSnapshot } from "../domain/knowledge-snapshot.js";
import type { KnowledgeVersionState } from "../domain/knowledge-version-state.js";
import { generateId } from "../utils/id.js";

export interface CreateKnowledgeSnapshotInput {
  readonly versionId: string;
  readonly name?: string;
  readonly capturedState: KnowledgeVersionState;
  readonly reason?: string;
  readonly capturedBy?: string;
}

/** Builds a fresh `KnowledgeSnapshot` record with a generated `id` and `capturedAt` stamped to now. */
export class KnowledgeVersionSnapshotFactory {
  create(input: CreateKnowledgeSnapshotInput): KnowledgeSnapshot {
    return {
      id: generateId(),
      versionId: input.versionId,
      name: input.name,
      capturedState: input.capturedState,
      reason: input.reason,
      capturedBy: input.capturedBy,
      capturedAt: new Date().toISOString(),
    };
  }
}
