import type { EmbeddingRequest } from "../domain/embedding-request.js";

export interface EmbeddingProviderResultInput {
  readonly dimensionCount: number;
  readonly providerReportedMetadata?: Readonly<Record<string, unknown>>;
}

/**
 * "IEmbeddingProvider" (docs/PROMPT-005.7N-EMBEDDING-MANAGER.md — "Extension Points") —
 * interface ONLY, never implemented in this package. The single seam through which a
 * caller-supplied OpenAI/Voyage AI/Cohere/Jina AI/Gemini/Ollama/FastEmbed/Custom adapter
 * performs the actual embedding generation. This package "MUST NEVER generate
 * embeddings" — the returned metadata MUST NOT contain the vector itself.
 */
export interface IEmbeddingProvider {
  embed(request: EmbeddingRequest): Promise<EmbeddingProviderResultInput>;
}
