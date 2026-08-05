import type { IKnowledgeProvider } from "../contracts/i-knowledge-provider.js";
import type { KnowledgeProviderCapabilityFlag } from "../domain/knowledge-provider-capability-flag.js";
import type { KnowledgeProviderCategory } from "../domain/knowledge-provider-category.js";
import type { ProviderMetadataRecord } from "../domain/provider-metadata-record.js";
import { ProviderNotFoundException } from "../errors/provider-not-found-exception.js";
import { KnowledgeProviderRegistryBucket } from "../registry/knowledge-provider-registry-bucket.js";
import type { KnowledgeProviderRegistry } from "../registry/knowledge-provider-registry.js";

/**
 * "RESOLVER: Resolve provider by Type, Category, Capability, Namespace, Source,
 * Priority, Metadata." (docs/PROMPT-005.7F-KNOWLEDGE-PROVIDER.md) — reads the
 * `PROVIDER`/`METADATA` buckets of `KnowledgeProviderRegistry`; owns no provider
 * implementation itself.
 */
export class KnowledgeProviderResolver {
  constructor(private readonly registry: KnowledgeProviderRegistry) {}

  resolveById(providerId: string): IKnowledgeProvider {
    const provider = this.registry.get<IKnowledgeProvider>(
      KnowledgeProviderRegistryBucket.PROVIDER,
      providerId,
    );
    if (!provider) {
      throw new ProviderNotFoundException(
        `No IKnowledgeProvider is registered for Provider Id "${providerId}"`,
      );
    }
    return provider;
  }

  tryResolveById(providerId: string): IKnowledgeProvider | undefined {
    return this.registry.get<IKnowledgeProvider>(
      KnowledgeProviderRegistryBucket.PROVIDER,
      providerId,
    );
  }

  /** "Source" resolution — the specific Provider instance registered for a given source id, an alias of `resolveById()`. */
  resolveBySource(sourceId: string): IKnowledgeProvider {
    return this.resolveById(sourceId);
  }

  resolveByType(category: KnowledgeProviderCategory): readonly IKnowledgeProvider[] {
    return this.registry
      .list<IKnowledgeProvider>(KnowledgeProviderRegistryBucket.PROVIDER)
      .filter((provider) => provider.category === category);
  }

  resolveByCategory(category: KnowledgeProviderCategory): readonly IKnowledgeProvider[] {
    return this.resolveByType(category);
  }

  resolveByCapability(flag: KnowledgeProviderCapabilityFlag): readonly IKnowledgeProvider[] {
    return this.registry
      .list<IKnowledgeProvider>(KnowledgeProviderRegistryBucket.PROVIDER)
      .filter((provider) => provider.capabilities.includes(flag));
  }

  resolveByNamespace(namespace: string): readonly ProviderMetadataRecord[] {
    return this.registry
      .list<ProviderMetadataRecord>(KnowledgeProviderRegistryBucket.METADATA)
      .filter((metadata) => metadata.providerNamespace === namespace);
  }

  resolveByPriority(): readonly IKnowledgeProvider[] {
    const providers = this.registry.list<IKnowledgeProvider>(
      KnowledgeProviderRegistryBucket.PROVIDER,
    );
    return [...providers].sort((a, b) => this.priorityOf(b.id) - this.priorityOf(a.id));
  }

  resolveByMetadata(
    predicate: (metadata: ProviderMetadataRecord) => boolean,
  ): readonly ProviderMetadataRecord[] {
    return this.registry
      .list<ProviderMetadataRecord>(KnowledgeProviderRegistryBucket.METADATA)
      .filter(predicate);
  }

  private priorityOf(providerId: string): number {
    return (
      this.registry.get<ProviderMetadataRecord>(
        KnowledgeProviderRegistryBucket.METADATA,
        providerId,
      )?.providerPriority ?? 0
    );
  }
}
