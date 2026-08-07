import { z } from "zod";

import { KnowledgeQualityAssessmentMode } from "./knowledge-quality-assessment-mode.js";

/**
 * "KnowledgeQualityAssessmentRequest" (docs/PROMPT-005.7L-KNOWLEDGE-QUALITY.md — an
 * operation input, not one of the 12 named domain aggregates) — the input to an
 * Assessment: which Assessment Mode, which Rules, which Profile, which Policy, and
 * which Configuration are desired. Never carries the assessed content itself.
 */
export const knowledgeQualityAssessmentRequestSchema = z.object({
  id: z.string().min(1),
  requestId: z.string().min(1),
  assessmentId: z.string().min(1),
  mode: z.nativeEnum(KnowledgeQualityAssessmentMode),
  targetReference: z.string().min(1),
  ruleIds: z.array(z.string().min(1)),
  profileId: z.string().optional(),
  policyId: z.string().optional(),
  configurationId: z.string().optional(),
  requestedBy: z.string().min(1),
  instructions: z.string().optional(),
  createdAt: z.string().datetime(),
});

export type KnowledgeQualityAssessmentRequest = z.infer<
  typeof knowledgeQualityAssessmentRequestSchema
>;
