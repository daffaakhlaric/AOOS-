import type { KnowledgeAsset } from "@aos/knowledge-engine";
import { parseKnowledgeNamespace } from "@aos/knowledge-engine";

import type { KnowledgeIndexContext } from "../context/knowledge-index-context.js";
import type { KnowledgeEmbeddingReference } from "../domain/knowledge-embedding-reference.js";
import { knowledgeEmbeddingReferenceSchema } from "../domain/knowledge-embedding-reference.js";
import type { KnowledgeIndexEntry } from "../domain/knowledge-index-entry.js";
import { KnowledgeIndexType } from "../domain/knowledge-index-type.js";
import { createKnowledgeIndexVersion } from "../domain/knowledge-index-version.js";
import { IndexBuildException } from "../errors/index-build-exception.js";
import { generateId } from "../utils/id.js";

/**
 * "INDEX BUILDER" (docs/PROMPT-005.7C-KNOWLEDGE-INDEXING.md — "RUNTIME FLOW") — builds
 * one or more `KnowledgeIndexEntry` records for a given `KnowledgeAsset` +
 * `KnowledgeIndexType`. Pure data transformation — no tokenization, no embedding
 * generation, no chunking; `embeddingRef` is only carried through from whatever the
 * caller already supplied on `context.metadata`.
 */
export class KnowledgeIndexBuilder {
  build(
    asset: KnowledgeAsset,
    indexType: KnowledgeIndexType,
    context: KnowledgeIndexContext,
  ): readonly KnowledgeIndexEntry[] {
    switch (indexType) {
      case KnowledgeIndexType.KEYWORD:
        return this.single(asset, indexType, asset.id, { tags: asset.tags });
      case KnowledgeIndexType.METADATA:
        return this.single(asset, indexType, "metadata", { ...asset.metadata });
      case KnowledgeIndexType.NAMESPACE:
        return this.single(asset, indexType, asset.namespace, { namespace: asset.namespace });
      case KnowledgeIndexType.RELATIONSHIP: {
        const relationships = context.variables["relationships"];
        const relationshipCount = Array.isArray(relationships) ? relationships.length : 0;
        return this.single(asset, indexType, asset.id, { relationshipCount });
      }
      case KnowledgeIndexType.POLICY:
        return this.single(asset, indexType, asset.classification, {
          classification: asset.classification,
        });
      case KnowledgeIndexType.PERMISSION:
        return this.single(asset, indexType, asset.owner.userId, { ownerId: asset.owner.userId });
      case KnowledgeIndexType.TEMPLATE:
        return this.single(asset, indexType, asset.templateId ?? "none", {
          templateId: asset.templateId,
        });
      case KnowledgeIndexType.TAG:
        return asset.tags.map((tag) => this.entry(asset, indexType, tag, { tag }));
      case KnowledgeIndexType.CATEGORY:
        return this.single(asset, indexType, asset.categoryId ?? "uncategorized", {
          categoryId: asset.categoryId,
        });
      case KnowledgeIndexType.LANGUAGE:
        return this.single(asset, indexType, asset.metadata.language ?? "unknown", {
          language: asset.metadata.language,
        });
      case KnowledgeIndexType.WORKSPACE:
        return this.single(asset, indexType, asset.scope.workspaceId ?? "none", {
          workspaceId: asset.scope.workspaceId,
        });
      case KnowledgeIndexType.TENANT:
        return this.single(asset, indexType, asset.scope.tenantId, {
          tenantId: asset.scope.tenantId,
        });
      case KnowledgeIndexType.DEPARTMENT:
        return this.single(asset, indexType, asset.scope.departmentId ?? "none", {
          departmentId: asset.scope.departmentId,
        });
      case KnowledgeIndexType.COLLECTION: {
        const library = parseKnowledgeNamespace(asset.namespace).library;
        return this.single(asset, indexType, library, { library });
      }
      case KnowledgeIndexType.ASSET_TYPE:
        return this.single(asset, indexType, asset.assetType, { assetType: asset.assetType });
      case KnowledgeIndexType.EMBEDDING_REFERENCE:
        return this.buildEmbeddingReference(asset, context);
      case KnowledgeIndexType.HYBRID_METADATA:
        return this.single(asset, indexType, "hybrid", {
          tags: asset.tags,
          classification: asset.classification,
          assetType: asset.assetType,
        });
    }
  }

  private buildEmbeddingReference(
    asset: KnowledgeAsset,
    context: KnowledgeIndexContext,
  ): readonly KnowledgeIndexEntry[] {
    const raw = context.metadata["embeddingRef"];
    const parsed = knowledgeEmbeddingReferenceSchema.safeParse(raw);
    if (!parsed.success) {
      throw new IndexBuildException(
        `Cannot build EMBEDDING_REFERENCE Index Entry for Asset "${asset.id}": no valid embeddingRef supplied on context.metadata`,
      );
    }
    return [
      this.entry(
        asset,
        KnowledgeIndexType.EMBEDDING_REFERENCE,
        parsed.data.embeddingId,
        { provider: parsed.data.provider, model: parsed.data.model },
        parsed.data,
      ),
    ];
  }

  private single(
    asset: KnowledgeAsset,
    indexType: KnowledgeIndexType,
    key: string,
    value: Readonly<Record<string, unknown>>,
  ): readonly KnowledgeIndexEntry[] {
    return [this.entry(asset, indexType, key, value)];
  }

  private entry(
    asset: KnowledgeAsset,
    indexType: KnowledgeIndexType,
    key: string,
    value: Readonly<Record<string, unknown>>,
    embeddingRef?: KnowledgeEmbeddingReference,
  ): KnowledgeIndexEntry {
    const now = new Date().toISOString();
    return {
      id: generateId(),
      indexType,
      assetId: asset.id,
      namespace: asset.namespace,
      tenantId: asset.scope.tenantId,
      workspaceId: asset.scope.workspaceId,
      departmentId: asset.scope.departmentId,
      key,
      value: { ...value },
      version: createKnowledgeIndexVersion(),
      chunkRefs: [],
      embeddingRef,
      createdAt: now,
      updatedAt: now,
    };
  }
}
