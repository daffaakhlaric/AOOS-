import { z } from "zod";

import { KnowledgeGeneratorSessionState } from "./knowledge-generator-session-state.js";

/**
 * "KnowledgeGenerationSession" (docs/PROMPT-005.7K-KNOWLEDGE-GENERATOR.md — "Domain
 * Model") — the business-level collaborative session a Generation runs under (the
 * caller/holder's access window over one Generation). Registered in the SESSION
 * Registry bucket keyed by `sessionId`. Distinct from `KnowledgeGeneratorSession`, the
 * Public API session-ledger class (`session/knowledge-generator-session.ts`) that
 * mutates records of this shape — matching the `KnowledgeMarketplaceSession` /
 * `KnowledgeMarketplaceSessionRecord` naming split in `@aos/knowledge-marketplace`.
 */
export const knowledgeGenerationSessionSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  generationId: z.string().min(1),
  tenantId: z.string().min(1),
  holder: z.string().min(1),
  state: z.nativeEnum(KnowledgeGeneratorSessionState),
  openedAt: z.string().datetime(),
  closedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
});

export type KnowledgeGenerationSession = z.infer<typeof knowledgeGenerationSessionSchema>;
