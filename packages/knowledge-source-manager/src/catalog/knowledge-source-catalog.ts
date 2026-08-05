import type { KnowledgeSourceMetadataRecord } from "../domain/knowledge-source-metadata-record.js";
import { CatalogEntryNotFoundException } from "../errors/catalog-entry-not-found-exception.js";

/**
 * "CATALOG: Maintain Source Catalog, Source Metadata, Provider Mapping, Namespace
 * Mapping, Collection Mapping, Workspace Mapping, Tenant Mapping."
 * (docs/PROMPT-005.7G-KNOWLEDGE-SOURCE-MANAGER.md) — a derived, secondary index over
 * whatever Sources are registered in `KnowledgeSourceRegistry`'s `SOURCE` bucket. Not a
 * store of its own record of truth: `register()`/`remove()` are driven by
 * `KnowledgeSourcePipeline`'s Catalog stage each time a Source is registered/updated/
 * removed, keeping these 5 Id-set mappings (by Provider/Namespace/Collection/Workspace/
 * Tenant) plus the flat `sourceId -> KnowledgeSourceMetadataRecord` "Source Catalog"
 * lookup in sync with the Registry.
 */
export class KnowledgeSourceCatalog {
  private readonly sourceCatalog = new Map<string, KnowledgeSourceMetadataRecord>();
  private readonly providerMapping = new Map<string, Set<string>>();
  private readonly namespaceMapping = new Map<string, Set<string>>();
  private readonly collectionMapping = new Map<string, Set<string>>();
  private readonly workspaceMapping = new Map<string, Set<string>>();
  private readonly tenantMapping = new Map<string, Set<string>>();

  register(metadata: KnowledgeSourceMetadataRecord): KnowledgeSourceMetadataRecord {
    this.remove(metadata.sourceId);
    this.sourceCatalog.set(metadata.sourceId, metadata);
    this.index(this.providerMapping, metadata.providerId, metadata.sourceId);
    if (metadata.namespace) {
      this.index(this.namespaceMapping, metadata.namespace, metadata.sourceId);
    }
    if (metadata.collection) {
      this.index(this.collectionMapping, metadata.collection, metadata.sourceId);
    }
    if (metadata.workspaceId) {
      this.index(this.workspaceMapping, metadata.workspaceId, metadata.sourceId);
    }
    this.index(this.tenantMapping, metadata.tenantId, metadata.sourceId);
    return metadata;
  }

  remove(sourceId: string): boolean {
    const existing = this.sourceCatalog.get(sourceId);
    if (!existing) {
      return false;
    }
    this.sourceCatalog.delete(sourceId);
    this.unindex(this.providerMapping, existing.providerId, sourceId);
    if (existing.namespace) {
      this.unindex(this.namespaceMapping, existing.namespace, sourceId);
    }
    if (existing.collection) {
      this.unindex(this.collectionMapping, existing.collection, sourceId);
    }
    if (existing.workspaceId) {
      this.unindex(this.workspaceMapping, existing.workspaceId, sourceId);
    }
    this.unindex(this.tenantMapping, existing.tenantId, sourceId);
    return true;
  }

  get(sourceId: string): KnowledgeSourceMetadataRecord | undefined {
    return this.sourceCatalog.get(sourceId);
  }

  require(sourceId: string): KnowledgeSourceMetadataRecord {
    const entry = this.sourceCatalog.get(sourceId);
    if (!entry) {
      throw new CatalogEntryNotFoundException(`No Catalog entry for Source "${sourceId}"`);
    }
    return entry;
  }

  all(): readonly KnowledgeSourceMetadataRecord[] {
    return Array.from(this.sourceCatalog.values());
  }

  count(): number {
    return this.sourceCatalog.size;
  }

  byProvider(providerId: string): readonly KnowledgeSourceMetadataRecord[] {
    return this.resolveIds(this.providerMapping, providerId);
  }

  byNamespace(namespace: string): readonly KnowledgeSourceMetadataRecord[] {
    return this.resolveIds(this.namespaceMapping, namespace);
  }

  byCollection(collection: string): readonly KnowledgeSourceMetadataRecord[] {
    return this.resolveIds(this.collectionMapping, collection);
  }

  byWorkspace(workspaceId: string): readonly KnowledgeSourceMetadataRecord[] {
    return this.resolveIds(this.workspaceMapping, workspaceId);
  }

  byTenant(tenantId: string): readonly KnowledgeSourceMetadataRecord[] {
    return this.resolveIds(this.tenantMapping, tenantId);
  }

  providerCount(): number {
    return this.providerMapping.size;
  }

  namespaceCount(): number {
    return this.namespaceMapping.size;
  }

  collectionCount(): number {
    return this.collectionMapping.size;
  }

  workspaceCount(): number {
    return this.workspaceMapping.size;
  }

  tenantCount(): number {
    return this.tenantMapping.size;
  }

  private index(mapping: Map<string, Set<string>>, key: string, sourceId: string): void {
    const existing = mapping.get(key);
    if (existing) {
      existing.add(sourceId);
      return;
    }
    mapping.set(key, new Set([sourceId]));
  }

  private unindex(mapping: Map<string, Set<string>>, key: string, sourceId: string): void {
    const set = mapping.get(key);
    if (!set) {
      return;
    }
    set.delete(sourceId);
    if (set.size === 0) {
      mapping.delete(key);
    }
  }

  private resolveIds(
    mapping: Map<string, Set<string>>,
    key: string,
  ): readonly KnowledgeSourceMetadataRecord[] {
    const ids = mapping.get(key);
    if (!ids) {
      return [];
    }
    return Array.from(ids)
      .map((sourceId) => this.sourceCatalog.get(sourceId))
      .filter((entry): entry is KnowledgeSourceMetadataRecord => entry !== undefined);
  }
}
