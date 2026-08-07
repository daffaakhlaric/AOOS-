import type { EmbeddingConfiguration } from "../domain/embedding-configuration.js";
import type { EmbeddingMetadata } from "../domain/embedding-metadata.js";
import type { EmbeddingModelName } from "../domain/embedding-model-name.js";
import type { EmbeddingModel } from "../domain/embedding-model.js";
import type { EmbeddingProviderType } from "../domain/embedding-provider-type.js";
import type { EmbeddingProvider } from "../domain/embedding-provider.js";
import { EmbeddingState } from "../domain/embedding-state.js";
import type { EmbeddingVersion } from "../domain/embedding-version.js";
import type { Embedding } from "../domain/embedding.js";
import { generateId } from "../utils/id.js";

/** "EmbeddingFactory" (docs/PROMPT-005.7N-EMBEDDING-MANAGER.md — "Factory") — creates `Embedding` instance envelopes, always starting in `Draft`. */
class EmbeddingInstanceFactory {
  create(input: {
    token: string;
    embeddingId: string;
    tenantId: string;
    workspaceId?: string;
  }): Embedding {
    const now = new Date().toISOString();
    return {
      id: input.embeddingId,
      token: input.token,
      embeddingId: input.embeddingId,
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      state: EmbeddingState.DRAFT,
      createdAt: now,
      updatedAt: now,
    };
  }
}

/** "ProviderFactory" — creates `EmbeddingProvider` records (metadata only; this package never implements a provider). */
class ProviderFactory {
  create(input: {
    providerId: string;
    name: string;
    type: EmbeddingProviderType;
    tenantId: string;
    active?: boolean;
  }): EmbeddingProvider {
    const now = new Date().toISOString();
    return {
      id: input.providerId,
      providerId: input.providerId,
      name: input.name,
      type: input.type,
      tenantId: input.tenantId,
      active: input.active ?? true,
      createdAt: now,
      updatedAt: now,
    };
  }
}

/** "ModelFactory" — creates `EmbeddingModel` records (metadata only). */
class ModelFactory {
  create(input: {
    modelId: string;
    name: EmbeddingModelName;
    providerType: EmbeddingProviderType;
    tenantId: string;
    dimensions?: number;
    active?: boolean;
  }): EmbeddingModel {
    const now = new Date().toISOString();
    return {
      id: input.modelId,
      modelId: input.modelId,
      name: input.name,
      providerType: input.providerType,
      tenantId: input.tenantId,
      dimensions: input.dimensions,
      active: input.active ?? true,
      createdAt: now,
      updatedAt: now,
    };
  }
}

/** "VersionFactory" — creates `EmbeddingVersion` records (metadata only). */
class VersionFactory {
  create(input: {
    versionId: string;
    modelId: string;
    providerType: EmbeddingProviderType;
    tenantId: string;
    versionLabel: string;
    compatibilityNotes?: string;
  }): EmbeddingVersion {
    return {
      id: input.versionId,
      versionId: input.versionId,
      modelId: input.modelId,
      providerType: input.providerType,
      tenantId: input.tenantId,
      versionLabel: input.versionLabel,
      compatibilityNotes: input.compatibilityNotes,
      createdAt: new Date().toISOString(),
    };
  }
}

/** "MetadataFactory" — creates `EmbeddingMetadata` records. */
class MetadataFactory {
  create(input: {
    embeddingId: string;
    title: string;
    tenantId: string;
    description?: string;
    workspaceId?: string;
    tags?: readonly string[];
    createdBy?: string;
  }): EmbeddingMetadata {
    const now = new Date().toISOString();
    const id = generateId();
    return {
      id,
      embeddingId: input.embeddingId,
      title: input.title,
      description: input.description,
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      tags: [...(input.tags ?? [])],
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    };
  }
}

/** "ConfigurationFactory" — creates `EmbeddingConfiguration` records. */
class ConfigurationFactory {
  create(input: {
    configurationId: string;
    embeddingId: string;
    tenantId: string;
    timeoutMs?: number;
    retries?: number;
    batchSize?: number;
    custom?: Readonly<Record<string, unknown>>;
  }): EmbeddingConfiguration {
    return {
      id: input.configurationId,
      configurationId: input.configurationId,
      embeddingId: input.embeddingId,
      tenantId: input.tenantId,
      timeoutMs: input.timeoutMs,
      retries: input.retries,
      batchSize: input.batchSize,
      custom: { ...input.custom },
      createdAt: new Date().toISOString(),
    };
  }
}

/**
 * "FACTORY: Embedding Factory, Provider Factory, Model Factory, Version Factory,
 * Metadata Factory, Configuration Factory." (docs/PROMPT-005.7N-EMBEDDING-MANAGER.md) —
 * "EmbeddingFactory" composes the 6 named sub-factories as `readonly` fields.
 */
export class EmbeddingFactory {
  readonly embedding = new EmbeddingInstanceFactory();
  readonly provider = new ProviderFactory();
  readonly model = new ModelFactory();
  readonly version = new VersionFactory();
  readonly metadata = new MetadataFactory();
  readonly configuration = new ConfigurationFactory();
}
