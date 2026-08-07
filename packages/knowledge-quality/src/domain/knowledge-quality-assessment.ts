import { z } from "zod";

import { KnowledgeQualityAssessmentState } from "./knowledge-quality-assessment-state.js";

/**
 * "KnowledgeQualityAssessment" (docs/PROMPT-005.7L-KNOWLEDGE-QUALITY.md — "Domain Model") —
 * the primary entity: one assessment instance envelope tracked through the 10-state
 * Lifecycle. Registered in the ASSESSMENT Registry bucket keyed by `assessmentId`.
 */
export const knowledgeQualityAssessmentSchema = z.object({
  id: z.string().min(1),
  token: z.string().min(1),
  assessmentId: z.string().min(1),
  tenantId: z.string().min(1),
  workspaceId: z.string().optional(),
  state: z.nativeEnum(KnowledgeQualityAssessmentState),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
});

export type KnowledgeQualityAssessment = z.infer<typeof knowledgeQualityAssessmentSchema>;
