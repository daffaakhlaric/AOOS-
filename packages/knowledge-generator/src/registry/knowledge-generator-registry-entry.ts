import type { KnowledgeGenerationMetadata } from "../domain/knowledge-generation-metadata.js";

/** The record kept in the GENERATION Registry bucket — a thin metadata index over one Generation's token/metadata. */
export interface KnowledgeGeneratorRegistryEntry {
  readonly id: string;
  readonly token: string;
  readonly metadata: KnowledgeGenerationMetadata;
}
