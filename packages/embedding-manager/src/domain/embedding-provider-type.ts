/**
 * "EMBEDDING PROVIDERS: Support metadata — OpenAI, Voyage AI, Cohere, Jina AI, Gemini,
 * Ollama, FastEmbed, Custom Provider. Metadata ONLY. Never implement providers."
 * (docs/PROMPT-005.7N-EMBEDDING-MANAGER.md) — the exact 8 provider-type metadata tags.
 * This package never calls any of these vendors; the enum exists purely so
 * `EmbeddingProvider` records and the Model→Provider compatibility catalog
 * (`./embedding-model-catalog.ts`) can classify a registered provider by type.
 */
export enum EmbeddingProviderType {
  OPENAI = "openai",
  VOYAGE_AI = "voyage_ai",
  COHERE = "cohere",
  JINA_AI = "jina_ai",
  GEMINI = "gemini",
  OLLAMA = "ollama",
  FAST_EMBED = "fast_embed",
  CUSTOM_PROVIDER = "custom_provider",
}
