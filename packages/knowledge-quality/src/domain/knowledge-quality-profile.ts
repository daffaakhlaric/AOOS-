import { z } from "zod";

import { KnowledgeQualityDimension } from "./knowledge-quality-dimension.js";

/**
 * "KnowledgeQualityProfile" (docs/PROMPT-005.7L-KNOWLEDGE-QUALITY.md — "Domain Model") —
 * a named bundle of Rule ids + Dimension weights, metadata only. This package never
 * interprets the weights itself — they are handed, unmodified, to a caller-supplied
 * `IKnowledgeQualityProvider`/`IKnowledgeQualityScoringProvider`. Registered in the
 * PROFILE Registry bucket keyed by `profileId`.
 */
export const knowledgeQualityProfileSchema = z.object({
  id: z.string().min(1),
  profileId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  tenantId: z.string().min(1),
  ruleIds: z.array(z.string().min(1)),
  dimensionWeights: z.record(z.nativeEnum(KnowledgeQualityDimension), z.number().min(0).max(1)),
  active: z.boolean().default(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type KnowledgeQualityProfile = z.infer<typeof knowledgeQualityProfileSchema>;
