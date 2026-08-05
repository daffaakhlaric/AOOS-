import type {
  KnowledgeAsset,
  KnowledgePermissionEngine,
  KnowledgePolicyEngine,
  KnowledgeRelationship,
  KnowledgeRelationshipEngine,
  KnowledgeRepository,
  KnowledgeSnapshot,
  KnowledgeTemplate,
  KnowledgeTemplateEngine,
  KnowledgeVersionEngine,
} from "@aos/knowledge-engine";
import type {
  KnowledgeIndexEntry,
  KnowledgeIndexResolver,
  KnowledgeIndexType,
} from "@aos/knowledge-indexing";

/**
 * "KnowledgeResolver" (docs/PROMPT-005.7D-KNOWLEDGE-RETRIEVAL.md — "PUBLIC API") — a
 * thin, read-only pass-through over the `@aos/knowledge-engine`/`@aos/knowledge-indexing`
 * engines this package is given, resolving Assets/Versions/Relationships/Templates and
 * the Index Entries a Search Strategy needs to build a `KnowledgeResult` — never mutates
 * anything, never performs a search itself. "Never query indexes directly." is a
 * statement about *callers of this package*; `KnowledgeResolver` is the one place inside
 * this package allowed to read the Index Registry, on their behalf.
 */
export class KnowledgeResolver {
  constructor(
    private readonly repository: KnowledgeRepository,
    private readonly relationshipEngine: KnowledgeRelationshipEngine,
    private readonly policyEngine: KnowledgePolicyEngine,
    private readonly permissionEngine: KnowledgePermissionEngine,
    private readonly versionEngine: KnowledgeVersionEngine,
    private readonly templateEngine: KnowledgeTemplateEngine,
    private readonly indexResolver: KnowledgeIndexResolver,
  ) {}

  resolveAsset(assetId: string): KnowledgeAsset {
    return this.repository.require(assetId);
  }

  tryResolveAsset(assetId: string): KnowledgeAsset | undefined {
    return this.repository.get(assetId);
  }

  resolveRelationships(assetId: string): readonly KnowledgeRelationship[] {
    return this.relationshipEngine.neighbors(assetId);
  }

  resolveVersionHistory(assetId: string): readonly KnowledgeSnapshot[] {
    return this.versionEngine.history(assetId);
  }

  resolveTemplate(templateId: string): KnowledgeTemplate {
    return this.templateEngine.require(templateId);
  }

  resolveIndexEntriesByType(indexType: KnowledgeIndexType): readonly KnowledgeIndexEntry[] {
    return this.indexResolver.resolveByType(indexType);
  }

  resolveIndexEntriesByAsset(assetId: string): readonly KnowledgeIndexEntry[] {
    return this.indexResolver.resolveByAsset(assetId);
  }

  get policy(): KnowledgePolicyEngine {
    return this.policyEngine;
  }

  get permission(): KnowledgePermissionEngine {
    return this.permissionEngine;
  }
}
