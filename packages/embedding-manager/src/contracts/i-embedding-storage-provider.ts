import type { EmbeddingResultMetadata } from "../domain/embedding-result-metadata.js";

/** "IEmbeddingStorageProvider" — interface ONLY. This package MUST NEVER connect directly to a vector database; a caller-supplied adapter persists the actual vector elsewhere. */
export interface IEmbeddingStorageProvider {
  store(resultMetadata: EmbeddingResultMetadata): Promise<void>;
}
