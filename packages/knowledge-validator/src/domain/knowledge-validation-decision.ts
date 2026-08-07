import { z } from "zod";

import { KnowledgeValidationDecisionValue } from "./knowledge-validation-decision-value.js";

/**
 * "KnowledgeValidationDecision" (docs/PROMPT-005.7M-KNOWLEDGE-VALIDATOR.md — "Domain
 * Model") — records WHICH of the 6 Validation Decision values a caller-supplied
 * `IKnowledgeValidationDecisionProvider`/reviewer reported for one Validation, who/what
 * reported it, and when. This package NEVER computes the decision itself — it only
 * records what was reported. Registered in the DECISION Registry bucket keyed by
 * `decisionId`.
 */
export const knowledgeValidationDecisionSchema = z.object({
  id: z.string().min(1),
  decisionId: z.string().min(1),
  validationId: z.string().min(1),
  tenantId: z.string().min(1),
  value: z.nativeEnum(KnowledgeValidationDecisionValue),
  reportedBy: z.string().min(1),
  confidence: z.number().min(0).max(1).optional(),
  reason: z.string().optional(),
  recordedAt: z.string().datetime(),
});

export type KnowledgeValidationDecision = z.infer<typeof knowledgeValidationDecisionSchema>;
