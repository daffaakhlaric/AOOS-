import { describe, expect, it } from "vitest";

import { EMBEDDING_MODEL_PROVIDER_CATALOG } from "../../src/domain/embedding-model-catalog.js";
import { EmbeddingModelName } from "../../src/domain/embedding-model-name.js";
import { EmbeddingProviderType } from "../../src/domain/embedding-provider-type.js";
import { EmbeddingState } from "../../src/domain/embedding-state.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { managerFixture } from "../helpers/manager-fixture.js";

/*
 * Cohere is intentionally excluded from this matrix: it has no catalog entry mapping
 * ANY of the 9 EmbeddingModelName labels to EmbeddingProviderType.COHERE (see
 * docs/005.7N-EMBEDDING-MANAGER-REPORT.md — "Models" for the judgment call) — a
 * Cohere-backed deployment is expected to register under EmbeddingModelName.CUSTOM
 * paired with EmbeddingProviderType.CUSTOM_PROVIDER instead, same as any provider
 * without a first-class label.
 */
const PROVIDERS_WITH_A_CATALOG_MODEL = Object.values(EmbeddingProviderType).filter(
  (providerType) => providerType !== EmbeddingProviderType.COHERE,
);

describe("EmbeddingManager — end-to-end flow for every Provider Type with a catalog Model", () => {
  it.each(PROVIDERS_WITH_A_CATALOG_MODEL)(
    "creates, queues, and prepares an Embedding under Provider %s with its catalog-compatible Model",
    async (providerType) => {
      const modelName = (Object.entries(EMBEDDING_MODEL_PROVIDER_CATALOG).find(
        ([, mappedProvider]) => mappedProvider === providerType,
      )?.[0] ?? EmbeddingModelName.CUSTOM) as EmbeddingModelName;

      const { manager } = managerFixture();
      await manager.registerProvider({
        name: `${providerType} Provider`,
        type: providerType,
        tenantId: "tenant-1",
      });
      await manager.registerModel({ name: modelName, providerType, tenantId: "tenant-1" });

      const record = await manager.createEmbedding({
        context: contextFixture({ embeddingId: `e-${providerType}` }),
        title: "Test",
        textReference: "ref-1",
        providerType,
        modelName,
        requestedBy: "user-1",
      });
      await manager.queue({ token: record.token });
      const prepared = await manager.prepare({ token: record.token });

      expect(prepared.state).toBe(EmbeddingState.PREPARING);
      expect(prepared.resolvedProvider?.type).toBe(providerType);
      expect(prepared.resolvedModel?.name).toBe(modelName);
    },
  );
});

describe("EmbeddingManager — Cohere has no catalog Model (documented gap)", () => {
  it("Cohere paired with any of the 9 EmbeddingModelName labels is rejected by the pre-flight Validator", async () => {
    const { manager } = managerFixture();
    await manager.registerProvider({
      name: "Cohere",
      type: EmbeddingProviderType.COHERE,
      tenantId: "tenant-1",
    });
    await expect(
      manager.createEmbedding({
        context: contextFixture({ embeddingId: "e-cohere" }),
        title: "Test",
        textReference: "ref-1",
        providerType: EmbeddingProviderType.COHERE,
        modelName: EmbeddingModelName.CUSTOM,
        requestedBy: "user-1",
      }),
    ).rejects.toThrow();
  });
});

describe("EmbeddingManager — end-to-end flow for every Model Name", () => {
  it.each(Object.values(EmbeddingModelName))(
    "creates and prepares an Embedding declaring Model %s",
    async (modelName) => {
      const providerType = EMBEDDING_MODEL_PROVIDER_CATALOG[modelName];
      const { manager } = managerFixture();
      await manager.registerProvider({
        name: `${providerType} Provider`,
        type: providerType,
        tenantId: "tenant-1",
      });
      await manager.registerModel({ name: modelName, providerType, tenantId: "tenant-1" });

      const record = await manager.createEmbedding({
        context: contextFixture({ embeddingId: `e-${modelName}` }),
        title: "Test",
        textReference: "ref-1",
        providerType,
        modelName,
        requestedBy: "user-1",
      });
      await manager.queue({ token: record.token });
      const prepared = await manager.prepare({ token: record.token });
      expect(prepared.resolvedModel?.name).toBe(modelName);
    },
  );
});
