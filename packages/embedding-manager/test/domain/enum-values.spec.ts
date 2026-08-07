import { describe, expect, it } from "vitest";

import {
  EMBEDDING_MODEL_PROVIDER_CATALOG,
  isModelCompatibleWithProvider,
} from "../../src/domain/embedding-model-catalog.js";
import { EmbeddingModelName } from "../../src/domain/embedding-model-name.js";
import { EmbeddingProviderType } from "../../src/domain/embedding-provider-type.js";
import {
  buildModelRegistryId,
  buildProviderRegistryId,
} from "../../src/domain/embedding-registry-keys.js";
import { EmbeddingSessionState } from "../../src/domain/embedding-session-state.js";
import { EmbeddingState } from "../../src/domain/embedding-state.js";

describe("EmbeddingProviderType", () => {
  const expected = [
    "openai",
    "voyage_ai",
    "cohere",
    "jina_ai",
    "gemini",
    "ollama",
    "fast_embed",
    "custom_provider",
  ];

  it("has exactly the 8 documented Providers", () => {
    expect(Object.values(EmbeddingProviderType).sort()).toEqual([...expected].sort());
    expect(Object.values(EmbeddingProviderType)).toHaveLength(8);
  });
});

describe("EmbeddingModelName", () => {
  const expected = [
    "text-embedding-3-small",
    "text-embedding-3-large",
    "voyage-large-2",
    "voyage-code-2",
    "jina-embeddings",
    "gemini-embedding",
    "nomic-embed",
    "bge-large",
    "custom",
  ];

  it("has exactly the 9 documented Models", () => {
    expect(Object.values(EmbeddingModelName).sort()).toEqual([...expected].sort());
    expect(Object.values(EmbeddingModelName)).toHaveLength(9);
  });
});

describe("EmbeddingState", () => {
  it("has exactly the 9 documented states", () => {
    expect(Object.values(EmbeddingState)).toHaveLength(9);
    expect(Object.values(EmbeddingState)).toEqual([
      "draft",
      "queued",
      "preparing",
      "embedding",
      "completed",
      "cancelled",
      "failed",
      "archived",
      "destroyed",
    ]);
  });
});

describe("EmbeddingSessionState", () => {
  it("has exactly the 4 documented states", () => {
    expect(Object.values(EmbeddingSessionState)).toEqual([
      "open",
      "closed",
      "cancelled",
      "expired",
    ]);
  });
});

describe("EMBEDDING_MODEL_PROVIDER_CATALOG", () => {
  it("has an entry for every EmbeddingModelName", () => {
    for (const modelName of Object.values(EmbeddingModelName)) {
      expect(EMBEDDING_MODEL_PROVIDER_CATALOG[modelName]).toBeDefined();
    }
  });

  it("maps text-embedding-3-small/large to OpenAI", () => {
    expect(EMBEDDING_MODEL_PROVIDER_CATALOG[EmbeddingModelName.TEXT_EMBEDDING_3_SMALL]).toBe(
      EmbeddingProviderType.OPENAI,
    );
    expect(EMBEDDING_MODEL_PROVIDER_CATALOG[EmbeddingModelName.TEXT_EMBEDDING_3_LARGE]).toBe(
      EmbeddingProviderType.OPENAI,
    );
  });

  it("maps voyage-large-2/code-2 to Voyage AI", () => {
    expect(EMBEDDING_MODEL_PROVIDER_CATALOG[EmbeddingModelName.VOYAGE_LARGE_2]).toBe(
      EmbeddingProviderType.VOYAGE_AI,
    );
    expect(EMBEDDING_MODEL_PROVIDER_CATALOG[EmbeddingModelName.VOYAGE_CODE_2]).toBe(
      EmbeddingProviderType.VOYAGE_AI,
    );
  });

  it("maps jina-embeddings to Jina AI", () => {
    expect(EMBEDDING_MODEL_PROVIDER_CATALOG[EmbeddingModelName.JINA_EMBEDDINGS]).toBe(
      EmbeddingProviderType.JINA_AI,
    );
  });

  it("maps gemini-embedding to Gemini", () => {
    expect(EMBEDDING_MODEL_PROVIDER_CATALOG[EmbeddingModelName.GEMINI_EMBEDDING]).toBe(
      EmbeddingProviderType.GEMINI,
    );
  });

  it("maps nomic-embed to Ollama", () => {
    expect(EMBEDDING_MODEL_PROVIDER_CATALOG[EmbeddingModelName.NOMIC_EMBED]).toBe(
      EmbeddingProviderType.OLLAMA,
    );
  });

  it("maps bge-large to FastEmbed", () => {
    expect(EMBEDDING_MODEL_PROVIDER_CATALOG[EmbeddingModelName.BGE_LARGE]).toBe(
      EmbeddingProviderType.FAST_EMBED,
    );
  });

  it("maps custom to Custom Provider", () => {
    expect(EMBEDDING_MODEL_PROVIDER_CATALOG[EmbeddingModelName.CUSTOM]).toBe(
      EmbeddingProviderType.CUSTOM_PROVIDER,
    );
  });

  it("isModelCompatibleWithProvider returns true for a matching pair", () => {
    expect(
      isModelCompatibleWithProvider(
        EmbeddingModelName.TEXT_EMBEDDING_3_SMALL,
        EmbeddingProviderType.OPENAI,
      ),
    ).toBe(true);
  });

  it("isModelCompatibleWithProvider returns false for a mismatched pair", () => {
    expect(
      isModelCompatibleWithProvider(
        EmbeddingModelName.TEXT_EMBEDDING_3_SMALL,
        EmbeddingProviderType.COHERE,
      ),
    ).toBe(false);
  });
});

describe("registry key builders", () => {
  it("buildProviderRegistryId is deterministic for the same tenant+type", () => {
    const a = buildProviderRegistryId("tenant-1", EmbeddingProviderType.OPENAI);
    const b = buildProviderRegistryId("tenant-1", EmbeddingProviderType.OPENAI);
    expect(a).toBe(b);
  });

  it("buildProviderRegistryId differs across tenants", () => {
    const a = buildProviderRegistryId("tenant-1", EmbeddingProviderType.OPENAI);
    const b = buildProviderRegistryId("tenant-2", EmbeddingProviderType.OPENAI);
    expect(a).not.toBe(b);
  });

  it("buildModelRegistryId is deterministic for the same tenant+name", () => {
    const a = buildModelRegistryId("tenant-1", EmbeddingModelName.CUSTOM);
    const b = buildModelRegistryId("tenant-1", EmbeddingModelName.CUSTOM);
    expect(a).toBe(b);
  });
});
