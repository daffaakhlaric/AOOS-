import { z } from "zod";

import { EmbeddingSessionState } from "./embedding-session-state.js";

/**
 * "EmbeddingSession" (docs/PROMPT-005.7N-EMBEDDING-MANAGER.md — "Domain Model") — the
 * business-level collaborative session an Embedding runs under (the caller/holder's
 * access window over one Embedding). Registered in the SESSION Registry bucket keyed by
 * `sessionId`. Exported as `EmbeddingSessionRecord` (NOT `EmbeddingSession`) to avoid a
 * same-name collision with the Public API class `EmbeddingSession`
 * (`session/embedding-session.ts`, the in-memory ledger implementing
 * Open/Resume/Close/Cancel/Expire/Renew) — the spec's own "Domain Model" and "Public
 * API" lists both literally say "EmbeddingSession"; this rename is a documented judgment
 * call (see docs/005.7N-EMBEDDING-MANAGER-REPORT.md).
 */
export const embeddingSessionSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  embeddingId: z.string().min(1),
  tenantId: z.string().min(1),
  holder: z.string().min(1),
  state: z.nativeEnum(EmbeddingSessionState),
  openedAt: z.string().datetime(),
  closedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
});

export type EmbeddingSessionRecord = z.infer<typeof embeddingSessionSchema>;
