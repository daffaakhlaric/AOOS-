import {
  buildKnowledgeNamespaceUri,
  DocumentFactory,
  KnowledgeAssetType,
  KnowledgeClassification,
  type KnowledgeAsset,
  type KnowledgeScope,
} from "@aos/knowledge-engine";

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
    assetType: KnowledgeAssetType.SUPPORT,
    scope,
    classification: overrides.classification ?? KnowledgeClassification.INTERNAL,
    ownerId: overrides.ownerId ?? "user-1",
    tags: overrides.tags,
  });
  return overrides.id ? { ...asset, id: overrides.id } : asset;
}
