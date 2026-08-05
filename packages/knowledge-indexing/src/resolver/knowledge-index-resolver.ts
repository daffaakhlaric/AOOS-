import type { KnowledgeIndexEntry } from "../domain/knowledge-index-entry.js";
import type { KnowledgeIndexType } from "../domain/knowledge-index-type.js";
import { KnowledgeIndexRegistryBucket } from "../registry/knowledge-index-registry-bucket.js";
import type { KnowledgeIndexRegistry } from "../registry/knowledge-index-registry.js";

/** "KnowledgeIndexResolver" (docs/PROMPT-005.7C-KNOWLEDGE-INDEXING.md — "PUBLIC API") — a thin, read-only pass-through over `KnowledgeIndexRegistry`'s `INDEX` bucket. Never mutates, never builds — that is `KnowledgeIndexBuilder`'s job. */
export class KnowledgeIndexResolver {
  constructor(private readonly registry: KnowledgeIndexRegistry) {}

  resolveById(id: string): KnowledgeIndexEntry {
    return this.registry.require<KnowledgeIndexEntry>(KnowledgeIndexRegistryBucket.INDEX, id);
  }

  tryResolveById(id: string): KnowledgeIndexEntry | undefined {
    return this.registry.get<KnowledgeIndexEntry>(KnowledgeIndexRegistryBucket.INDEX, id);
  }

  resolveByAsset(assetId: string): readonly KnowledgeIndexEntry[] {
    return this.registry
      .list<KnowledgeIndexEntry>(KnowledgeIndexRegistryBucket.INDEX)
      .filter((entry) => entry.assetId === assetId);
  }

  resolveByType(indexType: KnowledgeIndexType): readonly KnowledgeIndexEntry[] {
    return this.registry
      .list<KnowledgeIndexEntry>(KnowledgeIndexRegistryBucket.INDEX)
      .filter((entry) => entry.indexType === indexType);
  }

  resolveByNamespace(namespace: string): readonly KnowledgeIndexEntry[] {
    return this.registry
      .list<KnowledgeIndexEntry>(KnowledgeIndexRegistryBucket.INDEX)
      .filter((entry) => entry.namespace === namespace);
  }
}
