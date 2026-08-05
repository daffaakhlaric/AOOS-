import { KnowledgeRelationshipType, parseKnowledgeNamespace } from "@aos/knowledge-engine";
import type {
  KnowledgeAsset,
  KnowledgeContext,
  KnowledgeNamespace,
  KnowledgePermissionEngine,
  KnowledgePolicyEngine,
  KnowledgePolicyType,
  KnowledgeRelationship,
  KnowledgeRelationshipEngine,
  KnowledgeRepository,
  KnowledgeSnapshot,
  KnowledgeTemplate,
  KnowledgeTemplateEngine,
  KnowledgeVersionEngine,
  PolicyViolation,
} from "@aos/knowledge-engine";

/**
 * "RUNTIME RESOLVER: Resolve Knowledge Asset, Relationships, Dependencies, References,
 * Namespaces, Policies, Permissions, Versions, Templates. No retrieval. No indexing."
 * (docs/PROMPT-005.7B-KNOWLEDGE-RUNTIME.md) — a thin, read-only pass-through over the
 * `@aos/knowledge-engine` engines this package is given; never mutates anything, never
 * performs a search/index lookup itself (that is `KnowledgeRuntimeLoader#search()`'s job,
 * itself only a pass-through to `KnowledgeCatalog`).
 */
export class KnowledgeRuntimeResolver {
  constructor(
    private readonly repository: KnowledgeRepository,
    private readonly relationshipEngine: KnowledgeRelationshipEngine,
    private readonly policyEngine: KnowledgePolicyEngine,
    private readonly permissionEngine: KnowledgePermissionEngine,
    private readonly versionEngine: KnowledgeVersionEngine,
    private readonly templateEngine: KnowledgeTemplateEngine,
  ) {}

  resolveAsset(id: string): KnowledgeAsset {
    return this.repository.require(id);
  }

  resolveNamespace(uri: string): KnowledgeNamespace {
    return parseKnowledgeNamespace(uri);
  }

  resolveRelationships(assetId: string): readonly KnowledgeRelationship[] {
    return this.relationshipEngine.neighbors(assetId);
  }

  resolveDependencies(assetId: string): readonly KnowledgeRelationship[] {
    return this.relationshipEngine
      .outgoing(assetId)
      .filter((relationship) => relationship.type === KnowledgeRelationshipType.DEPENDS_ON);
  }

  resolveReferences(assetId: string): readonly KnowledgeRelationship[] {
    return this.relationshipEngine
      .outgoing(assetId)
      .filter((relationship) => relationship.type === KnowledgeRelationshipType.REFERENCE);
  }

  resolvePolicies(asset: KnowledgeAsset, type?: KnowledgePolicyType): readonly PolicyViolation[] {
    return this.policyEngine.evaluate(asset, type);
  }

  resolvePermission(context: KnowledgeContext, asset: KnowledgeAsset, action: string): boolean {
    return this.permissionEngine.check(context, asset, action);
  }

  resolveVersionHistory(assetId: string): readonly KnowledgeSnapshot[] {
    return this.versionEngine.history(assetId);
  }

  resolveTemplate(templateId: string): KnowledgeTemplate {
    return this.templateEngine.require(templateId);
  }
}
