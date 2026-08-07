import type { KnowledgeVersionMetadata } from "../domain/knowledge-version-metadata.js";
import type { KnowledgeVersionType } from "../domain/knowledge-version-type.js";

export interface CreateKnowledgeVersionMetadataInput {
  readonly versionId: string;
  readonly assetId: string;
  readonly versionName?: string;
  readonly versionDescription?: string;
  readonly versionType: KnowledgeVersionType;
  readonly versionNumber: string;
  readonly branchId?: string;
  readonly tenantId: string;
  readonly workspaceId?: string;
  readonly labels?: readonly string[];
  readonly tags?: readonly string[];
  readonly dependencies?: readonly string[];
  readonly createdBy?: string;
}

/** Builds a fresh `KnowledgeVersionMetadata` record with `createdAt`/`updatedAt` stamped to now. */
export class KnowledgeVersionVersionFactory {
  create(input: CreateKnowledgeVersionMetadataInput): KnowledgeVersionMetadata {
    const now = new Date().toISOString();
    return {
      versionId: input.versionId,
      assetId: input.assetId,
      versionName: input.versionName,
      versionDescription: input.versionDescription,
      versionType: input.versionType,
      versionNumber: input.versionNumber,
      branchId: input.branchId,
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      labels: [...(input.labels ?? [])],
      tags: [...(input.tags ?? [])],
      dependencies: [...(input.dependencies ?? [])],
      createdBy: input.createdBy,
      updatedBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    };
  }
}
