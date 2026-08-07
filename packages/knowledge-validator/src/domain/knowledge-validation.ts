import { z } from "zod";

import { KnowledgeValidationState } from "./knowledge-validation-state.js";

/**
 * "KnowledgeValidation" (docs/PROMPT-005.7M-KNOWLEDGE-VALIDATOR.md — "Domain Model") —
 * the primary entity: one validation instance envelope tracked through the 10-state
 * Lifecycle. Registered in the VALIDATION Registry bucket keyed by `validationId`.
 */
export const knowledgeValidationSchema = z.object({
  id: z.string().min(1),
  token: z.string().min(1),
  validationId: z.string().min(1),
  tenantId: z.string().min(1),
  workspaceId: z.string().optional(),
  state: z.nativeEnum(KnowledgeValidationState),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  startedAt: z.string().datetime().optional(),
  settledAt: z.string().datetime().optional(),
});

export type KnowledgeValidation = z.infer<typeof knowledgeValidationSchema>;
