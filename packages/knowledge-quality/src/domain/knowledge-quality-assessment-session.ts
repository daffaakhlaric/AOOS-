import { z } from "zod";

import { KnowledgeQualitySessionState } from "./knowledge-quality-session-state.js";

/**
 * "KnowledgeQualityAssessmentSession" (docs/PROMPT-005.7L-KNOWLEDGE-QUALITY.md — "Domain
 * Model") — the business-level collaborative session a Assessment runs under (the
 * caller/holder's access window over one Assessment). Registered in the SESSION
 * Registry bucket keyed by `sessionId`. Distinct from `KnowledgeQualitySession`, the
 * Public API session-ledger class (`session/knowledge-quality-session.ts`) that
 * mutates records of this shape — matching the `KnowledgeMarketplaceSession` /
 * `KnowledgeMarketplaceSessionRecord` naming split in `@aos/knowledge-marketplace`.
 */
export const knowledgeAssessmentSessionSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  assessmentId: z.string().min(1),
  tenantId: z.string().min(1),
  holder: z.string().min(1),
  state: z.nativeEnum(KnowledgeQualitySessionState),
  openedAt: z.string().datetime(),
  closedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
});

export type KnowledgeQualityAssessmentSession = z.infer<typeof knowledgeAssessmentSessionSchema>;
