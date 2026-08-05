import type { KnowledgeAsset } from "../../src/domain/knowledge-asset.js";
import { KnowledgeClassification } from "../../src/domain/knowledge-classification.js";
import type { KnowledgeScope } from "../../src/domain/knowledge-scope.js";
import { DocumentFactory } from "../../src/factory/document-factory.js";
import { buildKnowledgeNamespaceUri } from "../../src/namespace/knowledge-namespace.js";

const documentFactory = new DocumentFactory();

export function scopeFixture(overrides: Partial<KnowledgeScope> = {}): KnowledgeScope {
  return { tenantId: "tenant-1", workspaceId: "workspace-1", ...overrides };
}

export function assetFixture(
  overrides: {
    readonly id?: string;
    readonly namespace?: string;
    readonly scope?: KnowledgeScope;
    readonly classification?: KnowledgeClassification;
    readonly ownerId?: string;
    readonly tags?: readonly string[];
    readonly labels?: readonly string[];
    readonly categoryId?: string;
    readonly content?: Readonly<Record<string, unknown>>;
  } = {},
): KnowledgeAsset {
  const scope = overrides.scope ?? scopeFixture();
  const namespace =
    overrides.namespace ??
    buildKnowledgeNamespaceUri(
      scope.tenantId,
      scope.workspaceId ?? "workspace-1",
      "library-1",
      overrides.id ?? "doc-1",
    );
  const asset = documentFactory.create({
    namespace,
    scope,
    classification: overrides.classification ?? KnowledgeClassification.INTERNAL,
    ownerId: overrides.ownerId ?? "user-1",
    tags: overrides.tags,
    labels: overrides.labels,
    categoryId: overrides.categoryId,
    content: overrides.content,
  });
  return overrides.id ? { ...asset, id: overrides.id } : asset;
}
