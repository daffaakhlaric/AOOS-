import { EmbeddingModelName } from "./embedding-model-name.js";
import { EmbeddingProviderType } from "./embedding-provider-type.js";

/**
 * Built-in Model -> expected Provider compatibility catalog, used by the Pipeline's
 * Model Resolution stage (stage 3) to cross-check a declared `EmbeddingModelName`
 * against the Provider resolved in stage 2 (see docs/005.7N-EMBEDDING-MANAGER-REPORT.md
 * — "Pipeline" for the full judgment call). Not part of the spec's literal text, which
 * only lists the 8 Providers and 9 Models independently — this mapping is a documented
 * design decision:
 *
 * - text-embedding-3-small / text-embedding-3-large -> OpenAI (OpenAI's own naming)
 * - voyage-large-2 / voyage-code-2 -> Voyage AI (Voyage's own naming)
 * - jina-embeddings -> Jina AI (Jina's own naming)
 * - gemini-embedding -> Gemini (Google's own naming)
 * - nomic-embed -> Ollama (Nomic's embedding model ships as an Ollama-servable model)
 * - bge-large -> FastEmbed (BAAI's BGE family ships as a default FastEmbed model)
 * - custom -> Custom Provider (the only model allowed under a caller-defined provider)
 *
 * `Cohere` has no built-in catalog entry (Cohere's own `embed-*` model names are not in
 * the 9-model list) — a Cohere-backed deployment is expected to register its models
 * under `EmbeddingModelName.CUSTOM`, same as any provider without a first-class label.
 */
export const EMBEDDING_MODEL_PROVIDER_CATALOG: Readonly<
  Record<EmbeddingModelName, EmbeddingProviderType>
> = {
  [EmbeddingModelName.TEXT_EMBEDDING_3_SMALL]: EmbeddingProviderType.OPENAI,
  [EmbeddingModelName.TEXT_EMBEDDING_3_LARGE]: EmbeddingProviderType.OPENAI,
  [EmbeddingModelName.VOYAGE_LARGE_2]: EmbeddingProviderType.VOYAGE_AI,
  [EmbeddingModelName.VOYAGE_CODE_2]: EmbeddingProviderType.VOYAGE_AI,
  [EmbeddingModelName.JINA_EMBEDDINGS]: EmbeddingProviderType.JINA_AI,
  [EmbeddingModelName.GEMINI_EMBEDDING]: EmbeddingProviderType.GEMINI,
  [EmbeddingModelName.NOMIC_EMBED]: EmbeddingProviderType.OLLAMA,
  [EmbeddingModelName.BGE_LARGE]: EmbeddingProviderType.FAST_EMBED,
  [EmbeddingModelName.CUSTOM]: EmbeddingProviderType.CUSTOM_PROVIDER,
};

/**
 * Returns whether `modelName` is compatible with `providerType`. `CUSTOM_PROVIDER`
 * additionally accepts `EmbeddingModelName.CUSTOM` paired with ANY declared provider
 * type is rejected except its catalog entry — a Custom Provider deployment should
 * register the model as `custom` explicitly.
 */
export function isModelCompatibleWithProvider(
  modelName: EmbeddingModelName,
  providerType: EmbeddingProviderType,
): boolean {
  return EMBEDDING_MODEL_PROVIDER_CATALOG[modelName] === providerType;
}
