import type { KnowledgeSourceCategory } from "../domain/knowledge-source-category.js";
import type { KnowledgeSourceMetadataRecord } from "../domain/knowledge-source-metadata-record.js";

export interface CreateKnowledgeSourceMetadataInput {
  readonly sourceId: string;
  readonly sourceName: string;
  readonly sourceDescription?: string;
  readonly sourceCategory: KnowledgeSourceCategory;
  readonly sourceProvider: string;
  readonly providerId: string;
  readonly providerVersion?: string;
  readonly namespace?: string;
  readonly collection?: string;
  readonly workspaceId?: string;
  readonly tenantId: string;
  readonly organizationId?: string;
  readonly departmentId?: string;
  readonly labels?: readonly string[];
  readonly tags?: readonly string[];
  readonly priority?: number;
  readonly policy?: string;
  readonly permission?: string;
  readonly environment?: string;
  readonly owner?: string;
  readonly createdBy?: string;
  readonly updatedBy?: string;
}

/** Builds a fresh `KnowledgeSourceMetadataRecord`, defaulting optional list fields to empty and stamping `createdAt`/`updatedAt`. */
export class KnowledgeSourceMetadataFactory {
  create(input: CreateKnowledgeSourceMetadataInput): KnowledgeSourceMetadataRecord {
    const now = new Date().toISOString();
    return {
      sourceId: input.sourceId,
      sourceName: input.sourceName,
      sourceDescription: input.sourceDescription,
      sourceCategory: input.sourceCategory,
      sourceProvider: input.sourceProvider,
      providerId: input.providerId,
      providerVersion: input.providerVersion,
      namespace: input.namespace,
      collection: input.collection,
      workspaceId: input.workspaceId,
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      departmentId: input.departmentId,
      labels: [...(input.labels ?? [])],
      tags: [...(input.tags ?? [])],
      priority: input.priority ?? 0,
      policy: input.policy,
      permission: input.permission,
      environment: input.environment,
      owner: input.owner,
      createdBy: input.createdBy,
      updatedBy: input.updatedBy,
      createdAt: now,
      updatedAt: now,
    };
  }
}
