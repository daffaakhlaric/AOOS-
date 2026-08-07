import type { KnowledgeQualityAssessmentMetadata } from "../domain/knowledge-quality-assessment-metadata.js";

/** The record kept in the ASSESSMENT Registry bucket — a thin metadata index over one Assessment's token/metadata. */
export interface KnowledgeQualityRegistryEntry {
  readonly id: string;
  readonly token: string;
  readonly metadata: KnowledgeQualityAssessmentMetadata;
}
