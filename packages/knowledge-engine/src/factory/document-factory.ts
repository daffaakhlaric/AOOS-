import { KnowledgeAssetType } from "../domain/knowledge-asset-type.js";
import type { KnowledgeClassification } from "../domain/knowledge-classification.js";
import type { KnowledgeDocument } from "../domain/knowledge-document.js";
import { KnowledgeLifecycleState } from "../domain/knowledge-lifecycle-state.js";
import { EMPTY_KNOWLEDGE_STATISTICS } from "../domain/knowledge-metadata.js";
import type { KnowledgeScope } from "../domain/knowledge-scope.js";
import { generateId } from "../utils/id.js";

import { MetadataFactory, type CreateMetadataInput } from "./metadata-factory.js";
import { VersionFactory } from "./version-factory.js";

export interface CreateDocumentInput {
  readonly id?: string;
  readonly namespace: string;
  readonly assetType?: KnowledgeAssetType;
  readonly scope: KnowledgeScope;
  readonly classification: KnowledgeClassification;
  readonly ownerId: string;
  readonly metadata?: Omit<CreateMetadataInput, "classification">;
  readonly content?: Readonly<Record<string, unknown>>;
  readonly contentType?: string;
  readonly tags?: readonly string[];
  readonly labels?: readonly string[];
  readonly categoryId?: string;
  readonly sourceId?: string;
  readonly templateId?: string;
}

/**
 * Builds a fresh `KnowledgeDocument` (a `KnowledgeAsset` with `assetType: DOCUMENT` by
 * default) in `KnowledgeLifecycleState.DRAFT`, version `1.0.0`, empty Statistics. Every
 * other `*Factory` in this module composes the same set of domain pieces this factory
 * demonstrates end-to-end.
 */
export class DocumentFactory {
  constructor(
    private readonly metadataFactory: MetadataFactory = new MetadataFactory(),
    private readonly versionFactory: VersionFactory = new VersionFactory(),
  ) {}

  create(input: CreateDocumentInput): KnowledgeDocument {
    const now = new Date().toISOString();
    return {
      id: input.id ?? generateId(),
      namespace: input.namespace,
      assetType: input.assetType ?? KnowledgeAssetType.DOCUMENT,
      scope: input.scope,
      classification: input.classification,
      lifecycleState: KnowledgeLifecycleState.DRAFT,
      version: this.versionFactory.create(),
      metadata: this.metadataFactory.create({
        ...input.metadata,
        classification: input.classification,
      }),
      statistics: EMPTY_KNOWLEDGE_STATISTICS,
      owner: { userId: input.ownerId, assignedAt: now },
      tags: [...(input.tags ?? [])],
      labels: [...(input.labels ?? [])],
      categoryId: input.categoryId,
      sourceId: input.sourceId,
      templateId: input.templateId,
      content: input.content,
      contentType: input.contentType,
      createdAt: now,
      updatedAt: now,
    };
  }
}
