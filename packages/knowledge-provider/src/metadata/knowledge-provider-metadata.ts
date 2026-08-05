import type { KnowledgeProviderCategory } from "../domain/knowledge-provider-category.js";
import type { ProviderMetadataRecord } from "../domain/provider-metadata-record.js";
import { InvalidProviderMetadataException } from "../errors/invalid-provider-metadata-exception.js";
import { KnowledgeProviderRegistryBucket } from "../registry/knowledge-provider-registry-bucket.js";
import type { KnowledgeProviderRegistry } from "../registry/knowledge-provider-registry.js";

/**
 * "KnowledgeProviderMetadata" (docs/PROMPT-005.7F-KNOWLEDGE-PROVIDER.md — "PUBLIC API")
 * — register/read access over `KnowledgeProviderRegistry`'s `METADATA` bucket, keyed by
 * `ProviderMetadataRecord.providerId`.
 */
export class KnowledgeProviderMetadata {
  constructor(private readonly registry: KnowledgeProviderRegistry) {}

  register(metadata: ProviderMetadataRecord): ProviderMetadataRecord {
    return this.registry.replace(KnowledgeProviderRegistryBucket.METADATA, this.withId(metadata));
  }

  get(providerId: string): ProviderMetadataRecord | undefined {
    return this.registry.get<ProviderMetadataRecord>(
      KnowledgeProviderRegistryBucket.METADATA,
      providerId,
    );
  }

  require(providerId: string): ProviderMetadataRecord {
    return this.registry.require<ProviderMetadataRecord>(
      KnowledgeProviderRegistryBucket.METADATA,
      providerId,
    );
  }

  update(providerId: string, patch: Partial<ProviderMetadataRecord>): ProviderMetadataRecord {
    const current = this.require(providerId);
    if (patch.providerId !== undefined && patch.providerId !== providerId) {
      throw new InvalidProviderMetadataException(
        `Cannot change providerId "${providerId}" via update()`,
      );
    }
    return this.register({ ...current, ...patch, providerId });
  }

  list(): readonly ProviderMetadataRecord[] {
    return this.registry.list<ProviderMetadataRecord>(KnowledgeProviderRegistryBucket.METADATA);
  }

  listByCategory(category: KnowledgeProviderCategory): readonly ProviderMetadataRecord[] {
    return this.list().filter((metadata) => metadata.providerCategory === category);
  }

  listByTag(tag: string): readonly ProviderMetadataRecord[] {
    return this.list().filter((metadata) => metadata.providerTags.includes(tag));
  }

  private withId(metadata: ProviderMetadataRecord): ProviderMetadataRecord & { id: string } {
    return { ...metadata, id: metadata.providerId };
  }
}
