import type { EmbeddingConfiguration } from "../domain/embedding-configuration.js";
import type { EmbeddingModel } from "../domain/embedding-model.js";
import type { EmbeddingNamespace } from "../domain/embedding-namespace.js";
import type { EmbeddingProvider } from "../domain/embedding-provider.js";
import type { EmbeddingVersion } from "../domain/embedding-version.js";
import type { Embedding } from "../domain/embedding.js";
import { EmbeddingNotFoundException } from "../errors/embedding-not-found-exception.js";
import { EmbeddingRegistryBucket } from "../registry/embedding-registry-bucket.js";
import type { EmbeddingRegistry } from "../registry/embedding-registry.js";

/**
 * "RESOLVER: Embedding Resolver, Provider Resolver, Model Resolver, Namespace Resolver,
 * Version Resolver." (docs/PROMPT-005.7N-EMBEDDING-MANAGER.md) — the exact 5 resolution
 * dimensions, implemented as 5 method pairs on one class (matching the
 * `KnowledgeValidatorResolver` shape — verified against
 * `packages/knowledge-validator/src/resolver/knowledge-validator-resolver.ts`). Every
 * resolve against a Registry bucket is a direct Map lookup by id — "Never scan
 * collections." Also carries a 6th, EXTRA "Configuration Resolver" pair, backed by a
 * dedicated in-memory map rather than a Registry bucket — Configuration is NOT one of
 * the spec's 8 Registry buckets, matching the `KnowledgeValidatorResolver`'s Policy
 * precedent (also resolver-local, not bucket-backed).
 */
export class EmbeddingResolver {
  private readonly configurationsById = new Map<string, EmbeddingConfiguration>();

  constructor(private readonly registry: EmbeddingRegistry) {}

  /* ---- 1. Embedding Resolver ---- */
  resolveEmbedding(embeddingId: string): Embedding {
    const entry = this.tryResolveEmbedding(embeddingId);
    if (!entry) {
      throw new EmbeddingNotFoundException(
        `No Embedding is registered for Embedding Id "${embeddingId}"`,
      );
    }
    return entry;
  }

  tryResolveEmbedding(embeddingId: string): Embedding | undefined {
    return this.registry.get<Embedding>(EmbeddingRegistryBucket.EMBEDDING, embeddingId);
  }

  /* ---- 2. Provider Resolver ---- */
  resolveProvider(providerId: string): EmbeddingProvider {
    const entry = this.tryResolveProvider(providerId);
    if (!entry) {
      throw new EmbeddingNotFoundException(
        `No Provider is registered for Provider Id "${providerId}"`,
      );
    }
    return entry;
  }

  tryResolveProvider(providerId: string): EmbeddingProvider | undefined {
    return this.registry.get<EmbeddingProvider>(EmbeddingRegistryBucket.PROVIDER, providerId);
  }

  /* ---- 3. Model Resolver ---- */
  resolveModel(modelId: string): EmbeddingModel {
    const entry = this.tryResolveModel(modelId);
    if (!entry) {
      throw new EmbeddingNotFoundException(`No Model is registered for Model Id "${modelId}"`);
    }
    return entry;
  }

  tryResolveModel(modelId: string): EmbeddingModel | undefined {
    return this.registry.get<EmbeddingModel>(EmbeddingRegistryBucket.MODEL, modelId);
  }

  /* ---- 4. Namespace Resolver ---- */
  resolveNamespace(namespaceId: string): EmbeddingNamespace {
    const entry = this.tryResolveNamespace(namespaceId);
    if (!entry) {
      throw new EmbeddingNotFoundException(
        `No Namespace is registered for Namespace Id "${namespaceId}"`,
      );
    }
    return entry;
  }

  tryResolveNamespace(namespaceId: string): EmbeddingNamespace | undefined {
    return this.registry.get<EmbeddingNamespace>(EmbeddingRegistryBucket.NAMESPACE, namespaceId);
  }

  /* ---- 5. Version Resolver ---- */
  resolveVersion(versionId: string): EmbeddingVersion {
    const entry = this.tryResolveVersion(versionId);
    if (!entry) {
      throw new EmbeddingNotFoundException(
        `No Version is registered for Version Id "${versionId}"`,
      );
    }
    return entry;
  }

  tryResolveVersion(versionId: string): EmbeddingVersion | undefined {
    return this.registry.get<EmbeddingVersion>(EmbeddingRegistryBucket.VERSION, versionId);
  }

  /* ---- Extra: Configuration Resolver (not one of the 5 named Resolvers; resolver-local map, not a Registry bucket) ---- */
  registerConfiguration(configuration: EmbeddingConfiguration): EmbeddingConfiguration {
    this.configurationsById.set(configuration.configurationId, configuration);
    return configuration;
  }

  resolveConfiguration(configurationId: string): EmbeddingConfiguration {
    const entry = this.tryResolveConfiguration(configurationId);
    if (!entry) {
      throw new EmbeddingNotFoundException(
        `No Configuration is registered for Configuration Id "${configurationId}"`,
      );
    }
    return entry;
  }

  tryResolveConfiguration(configurationId: string): EmbeddingConfiguration | undefined {
    return this.configurationsById.get(configurationId);
  }
}
