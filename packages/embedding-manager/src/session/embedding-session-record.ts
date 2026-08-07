import { z } from "zod";

import { EmbeddingSessionState } from "../domain/embedding-session-state.js";

/** The internal, token-keyed ledger record `EmbeddingSession` mutates — distinct from the `EmbeddingSessionRecord` domain aggregate registered in the SESSION Registry bucket. */
export const embeddingSessionLedgerRecordSchema = z.object({
  id: z.string().min(1),
  token: z.string().min(1),
  holder: z.string().min(1),
  state: z.nativeEnum(EmbeddingSessionState),
  openedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  closedAt: z.string().datetime().optional(),
  renewedAt: z.string().datetime().optional(),
});

export type EmbeddingSessionLedgerRecord = z.infer<typeof embeddingSessionLedgerRecordSchema>;
