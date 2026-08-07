import type { KnowledgeValidationMetadata } from "../domain/knowledge-validation-metadata.js";

/** The record kept in the VALIDATION Registry bucket — a thin metadata index over one Validation's token/metadata. */
export interface KnowledgeValidatorRegistryEntry {
  readonly id: string;
  readonly token: string;
  readonly metadata: KnowledgeValidationMetadata;
}
