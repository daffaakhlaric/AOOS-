import type { EmbeddingResultMetadata } from "../domain/embedding-result-metadata.js";

/** "IEmbeddingStreamingProvider" — interface ONLY. A caller-supplied streaming transport for incremental ResultMetadata delivery (e.g. batch embedding progress). */
export interface IEmbeddingStreamingProvider {
  stream(embeddingId: string): AsyncIterable<EmbeddingResultMetadata>;
}
