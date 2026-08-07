import { z } from "zod";

import { KnowledgeValidationSessionState } from "./knowledge-validation-session-state.js";

/**
 * "KnowledgeValidationSession" (docs/PROMPT-005.7M-KNOWLEDGE-VALIDATOR.md — "Domain
 * Model") — the business-level collaborative session a Validation runs under (the
 * caller/holder's access window over one Validation). Registered in the SESSION
 * Registry bucket keyed by `sessionId`. Distinct from `KnowledgeValidatorSession`, the
 * Public API session-ledger class (`session/knowledge-validator-session.ts`) that
 * mutates records of this shape.
 */
export const knowledgeValidationSessionSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  validationId: z.string().min(1),
  tenantId: z.string().min(1),
  holder: z.string().min(1),
  state: z.nativeEnum(KnowledgeValidationSessionState),
  openedAt: z.string().datetime(),
  closedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
});

export type KnowledgeValidationSession = z.infer<typeof knowledgeValidationSessionSchema>;
