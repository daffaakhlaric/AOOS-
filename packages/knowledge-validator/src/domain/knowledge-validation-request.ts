import { z } from "zod";

import { KnowledgeValidationCategory } from "./knowledge-validation-category.js";

/**
 * "KnowledgeValidationRequest" (docs/PROMPT-005.7M-KNOWLEDGE-VALIDATOR.md — an
 * operation input, not one of the 12 named domain aggregates) — the input to a
 * Validation: which Validation Category, which Rules, which Policy, and which
 * Configuration are desired. Never carries the validated content itself. `category` is
 * the primary declared Validation Category for this Request — a documented judgment
 * call keying `KnowledgeValidatorStatistics` (see docs/005.7M-KNOWLEDGE-VALIDATOR-AI-
 * REPORT.md — "Statistics"), mirroring how `@aos/knowledge-quality` keyed its Statistics
 * by Assessment Mode.
 */
export const knowledgeValidationRequestSchema = z.object({
  id: z.string().min(1),
  requestId: z.string().min(1),
  validationId: z.string().min(1),
  category: z.nativeEnum(KnowledgeValidationCategory),
  targetReference: z.string().min(1),
  ruleIds: z.array(z.string().min(1)),
  policyId: z.string().optional(),
  configurationId: z.string().optional(),
  requestedBy: z.string().min(1),
  instructions: z.string().optional(),
  createdAt: z.string().datetime(),
});

export type KnowledgeValidationRequest = z.infer<typeof knowledgeValidationRequestSchema>;
