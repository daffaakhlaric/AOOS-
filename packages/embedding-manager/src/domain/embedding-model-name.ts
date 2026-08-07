/**
 * "EMBEDDING MODELS: Support metadata — text-embedding-3-small, text-embedding-3-large,
 * voyage-large-2, voyage-code-2, jina-embeddings, gemini-embedding, nomic-embed,
 * bge-large, custom. Metadata ONLY." (docs/PROMPT-005.7N-EMBEDDING-MANAGER.md) — the
 * exact 9 model-name metadata labels.
 */
export enum EmbeddingModelName {
  TEXT_EMBEDDING_3_SMALL = "text-embedding-3-small",
  TEXT_EMBEDDING_3_LARGE = "text-embedding-3-large",
  VOYAGE_LARGE_2 = "voyage-large-2",
  VOYAGE_CODE_2 = "voyage-code-2",
  JINA_EMBEDDINGS = "jina-embeddings",
  GEMINI_EMBEDDING = "gemini-embedding",
  NOMIC_EMBED = "nomic-embed",
  BGE_LARGE = "bge-large",
  CUSTOM = "custom",
}
