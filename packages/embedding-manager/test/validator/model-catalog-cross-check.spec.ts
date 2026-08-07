import { describe, expect, it } from "vitest";

import { EmbeddingModelName } from "../../src/domain/embedding-model-name.js";
import { EmbeddingProviderType } from "../../src/domain/embedding-provider-type.js";
import { ModelValidator } from "../../src/validator/model-validator.js";
import { validatorInputFixture } from "../helpers/validator-input-fixture.js";

const stage = new ModelValidator();

const compatiblePairs: readonly [EmbeddingModelName, EmbeddingProviderType][] = [
  [EmbeddingModelName.TEXT_EMBEDDING_3_SMALL, EmbeddingProviderType.OPENAI],
  [EmbeddingModelName.TEXT_EMBEDDING_3_LARGE, EmbeddingProviderType.OPENAI],
  [EmbeddingModelName.VOYAGE_LARGE_2, EmbeddingProviderType.VOYAGE_AI],
  [EmbeddingModelName.VOYAGE_CODE_2, EmbeddingProviderType.VOYAGE_AI],
  [EmbeddingModelName.JINA_EMBEDDINGS, EmbeddingProviderType.JINA_AI],
  [EmbeddingModelName.GEMINI_EMBEDDING, EmbeddingProviderType.GEMINI],
  [EmbeddingModelName.NOMIC_EMBED, EmbeddingProviderType.OLLAMA],
  [EmbeddingModelName.BGE_LARGE, EmbeddingProviderType.FAST_EMBED],
  [EmbeddingModelName.CUSTOM, EmbeddingProviderType.CUSTOM_PROVIDER],
];

describe("ModelValidator — full compatibility matrix", () => {
  it.each(compatiblePairs)("passes for %s under %s", (modelName, providerType) => {
    const input = validatorInputFixture();
    const result = stage.validate({
      ...input,
      request: { ...input.request, modelName, providerType },
    });
    expect(result.valid).toBe(true);
  });

  for (const [modelName] of compatiblePairs) {
    for (const providerType of Object.values(EmbeddingProviderType)) {
      const isCompatible = compatiblePairs.some(([m, p]) => m === modelName && p === providerType);
      if (isCompatible) continue;
      it(`flags ${modelName} under mismatched provider ${providerType}`, () => {
        const input = validatorInputFixture();
        const result = stage.validate({
          ...input,
          request: { ...input.request, modelName, providerType },
        });
        expect(result.valid).toBe(false);
      });
    }
  }
});
