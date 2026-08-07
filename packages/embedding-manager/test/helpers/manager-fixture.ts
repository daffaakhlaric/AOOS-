import type { IPublisher } from "@aos/event-bus";
import type { vi } from "vitest";

import type { EmbeddingManagerConfig } from "../../src/config/embedding-manager-config.js";
import { EmbeddingModelName } from "../../src/domain/embedding-model-name.js";
import { EmbeddingProviderType } from "../../src/domain/embedding-provider-type.js";
import { EmbeddingManager } from "../../src/embedding/embedding-manager.js";

import { contextFixture } from "./context-fixture.js";
import { fakePublisher } from "./event-publisher-fixture.js";

export function managerFixture(config: EmbeddingManagerConfig = {}): {
  manager: EmbeddingManager;
  publisher: IPublisher;
  publish: ReturnType<typeof vi.fn>;
} {
  const { publisher, publish } = fakePublisher();
  return { manager: new EmbeddingManager(publisher, config), publisher, publish };
}

/** Registers an active OpenAI Provider + compatible Model for the given tenant (idempotent). */
export async function registerDefaultProviderAndModel(
  manager: EmbeddingManager,
  overrides: {
    readonly tenantId?: string;
    readonly providerType?: EmbeddingProviderType;
    readonly modelName?: EmbeddingModelName;
    readonly active?: boolean;
  } = {},
): Promise<{
  readonly providerType: EmbeddingProviderType;
  readonly modelName: EmbeddingModelName;
}> {
  const tenantId = overrides.tenantId ?? "tenant-1";
  const providerType = overrides.providerType ?? EmbeddingProviderType.OPENAI;
  const modelName = overrides.modelName ?? EmbeddingModelName.TEXT_EMBEDDING_3_SMALL;

  if (!manager.resolver.tryResolveProvider(`${tenantId}::${providerType}`)) {
    await manager.registerProvider({
      name: `${providerType} Provider`,
      type: providerType,
      tenantId,
      active: overrides.active ?? true,
    });
  }
  if (!manager.resolver.tryResolveModel(`${tenantId}::${modelName}`)) {
    await manager.registerModel({
      name: modelName,
      providerType,
      tenantId,
      active: overrides.active ?? true,
    });
  }
  return { providerType, modelName };
}

/** Registers a default Provider/Model and creates a Draft Embedding, returning its token for further operations. */
export async function createDraftEmbedding(
  manager: EmbeddingManager,
  overrides: {
    readonly tenantId?: string;
    readonly providerType?: EmbeddingProviderType;
    readonly modelName?: EmbeddingModelName;
    readonly namespaceId?: string;
    readonly configurationId?: string;
    readonly requestedBy?: string;
  } = {},
): Promise<string> {
  const tenantId = overrides.tenantId ?? "tenant-1";
  const { providerType, modelName } = await registerDefaultProviderAndModel(manager, {
    tenantId,
    providerType: overrides.providerType,
    modelName: overrides.modelName,
  });

  const suffix = Math.random().toString(36).slice(2, 8);
  const context = contextFixture({ embeddingId: `embedding-${suffix}`, tenantId });
  const record = await manager.createEmbedding({
    context,
    title: "Test Embedding",
    textReference: `text-ref-${suffix}`,
    providerType,
    modelName,
    namespaceId: overrides.namespaceId,
    configurationId: overrides.configurationId,
    requestedBy: overrides.requestedBy ?? "user-1",
  });

  return record.token;
}

/** Drives a Draft Embedding all the way to Embedding (the in-progress state), returning its token. */
export async function createEmbeddingInProgress(
  manager: EmbeddingManager,
  overrides: Parameters<typeof createDraftEmbedding>[1] = {},
): Promise<string> {
  const token = await createDraftEmbedding(manager, overrides);
  await manager.queue({ token });
  await manager.prepare({ token });
  await manager.start({ token });
  return token;
}

/** Drives a Draft Embedding all the way to Completed, returning its token. */
export async function createCompletedEmbedding(
  manager: EmbeddingManager,
  overrides: Parameters<typeof createDraftEmbedding>[1] = {},
): Promise<string> {
  const token = await createEmbeddingInProgress(manager, overrides);
  await manager.complete({ token });
  return token;
}
