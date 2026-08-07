import type { KnowledgeVersionConfigurationRecord } from "../configuration/knowledge-version-configuration-record.js";

export interface CreateKnowledgeVersionConfigurationInput {
  readonly versionId: string;
  readonly autoSnapshot?: boolean;
  readonly immutablePublished?: boolean;
  readonly allowRollback?: boolean;
  readonly allowMerge?: boolean;
  readonly retentionDays?: number;
  readonly maxSnapshots?: number;
  readonly maxRevisions?: number;
  readonly settings?: Readonly<Record<string, unknown>>;
}

/** Builds a fresh `KnowledgeVersionConfigurationRecord` with sensible defaults. */
export class KnowledgeVersionConfigurationFactory {
  create(input: CreateKnowledgeVersionConfigurationInput): KnowledgeVersionConfigurationRecord {
    return {
      versionId: input.versionId,
      autoSnapshot: input.autoSnapshot ?? false,
      immutablePublished: input.immutablePublished ?? true,
      allowRollback: input.allowRollback ?? true,
      allowMerge: input.allowMerge ?? true,
      retentionDays: input.retentionDays,
      maxSnapshots: input.maxSnapshots,
      maxRevisions: input.maxRevisions,
      settings: { ...(input.settings ?? {}) },
    };
  }
}
