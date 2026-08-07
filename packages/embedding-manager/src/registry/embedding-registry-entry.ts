import type { EmbeddingMetadata } from "../domain/embedding-metadata.js";

/** The record kept in the EMBEDDING Registry bucket — a thin metadata index over one Embedding's token/metadata. */
export interface EmbeddingRegistryEntry {
  readonly id: string;
  readonly token: string;
  readonly metadata: EmbeddingMetadata;
}
