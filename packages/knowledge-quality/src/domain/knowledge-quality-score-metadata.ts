import { z } from "zod";

import { KnowledgeQualityDimension } from "./knowledge-quality-dimension.js";

/**
 * "KnowledgeQualityScoreMetadata" (docs/PROMPT-005.7L-KNOWLEDGE-QUALITY.md — "Domain
 * Model") — metadata ABOUT a score as reported by a caller-supplied
 * `IKnowledgeQualityScoringProvider`: which Dimension, the numeric or qualitative value
 * the provider reported, when it was recorded, and which provider reported it. This
 * package NEVER computes the score itself — it only records what a provider reported.
 * Registered nowhere on its own (no dedicated Registry bucket); referenced by id from a
 * `KnowledgeQualityReport`.
 */
export const knowledgeQualityScoreMetadataSchema = z.object({
  id: z.string().min(1),
  scoreId: z.string().min(1),
  assessmentId: z.string().min(1),
  tenantId: z.string().min(1),
  dimension: z.nativeEnum(KnowledgeQualityDimension),
  value: z.number().optional(),
  qualitativeValue: z.string().optional(),
  providerId: z.string().min(1),
  recordedAt: z.string().datetime(),
});

export type KnowledgeQualityScoreMetadata = z.infer<typeof knowledgeQualityScoreMetadataSchema>;
