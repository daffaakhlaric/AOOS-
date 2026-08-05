import type { KnowledgeSourceCatalog } from "../catalog/knowledge-source-catalog.js";
import type { KnowledgeSourceCategory } from "../domain/knowledge-source-category.js";
import type { KnowledgeSourceMetadataRecord } from "../domain/knowledge-source-metadata-record.js";
import { SourceNotFoundException } from "../errors/source-not-found-exception.js";

/**
 * "RESOLVER: Resolve by Source Id, Provider, Category, Workspace, Tenant, Namespace,
 * Collection, Policy, Permission, Metadata, Priority." (docs/PROMPT-005.7G-KNOWLEDGE-SOURCE-MANAGER.md)
 * — the exact 11 resolution dimensions from the prompt. Reads `KnowledgeSourceCatalog`'s
 * indexes; owns no Source data itself.
 */
export class KnowledgeSourceResolver {
  constructor(private readonly catalog: KnowledgeSourceCatalog) {}

  resolveById(sourceId: string): KnowledgeSourceMetadataRecord {
    const entry = this.catalog.get(sourceId);
    if (!entry) {
      throw new SourceNotFoundException(`No Source is registered for Source Id "${sourceId}"`);
    }
    return entry;
  }

  tryResolveById(sourceId: string): KnowledgeSourceMetadataRecord | undefined {
    return this.catalog.get(sourceId);
  }

  resolveByProvider(providerId: string): readonly KnowledgeSourceMetadataRecord[] {
    return this.catalog.byProvider(providerId);
  }

  resolveByCategory(category: KnowledgeSourceCategory): readonly KnowledgeSourceMetadataRecord[] {
    return this.catalog.all().filter((entry) => entry.sourceCategory === category);
  }

  resolveByWorkspace(workspaceId: string): readonly KnowledgeSourceMetadataRecord[] {
    return this.catalog.byWorkspace(workspaceId);
  }

  resolveByTenant(tenantId: string): readonly KnowledgeSourceMetadataRecord[] {
    return this.catalog.byTenant(tenantId);
  }

  resolveByNamespace(namespace: string): readonly KnowledgeSourceMetadataRecord[] {
    return this.catalog.byNamespace(namespace);
  }

  resolveByCollection(collection: string): readonly KnowledgeSourceMetadataRecord[] {
    return this.catalog.byCollection(collection);
  }

  resolveByPolicy(policy: string): readonly KnowledgeSourceMetadataRecord[] {
    return this.catalog.all().filter((entry) => entry.policy === policy);
  }

  resolveByPermission(permission: string): readonly KnowledgeSourceMetadataRecord[] {
    return this.catalog.all().filter((entry) => entry.permission === permission);
  }

  resolveByMetadata(
    predicate: (metadata: KnowledgeSourceMetadataRecord) => boolean,
  ): readonly KnowledgeSourceMetadataRecord[] {
    return this.catalog.all().filter(predicate);
  }

  resolveByPriority(): readonly KnowledgeSourceMetadataRecord[] {
    return [...this.catalog.all()].sort((a, b) => b.priority - a.priority);
  }
}
