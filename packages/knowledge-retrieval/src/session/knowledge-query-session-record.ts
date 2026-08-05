import { z } from "zod";

import { KnowledgeQuerySessionState } from "./knowledge-query-session-state.js";

/** One open Session over a `KnowledgeRetrievalToken` — "No persistence": `KnowledgeQuerySession` only ever holds these in memory. */
export const knowledgeQuerySessionRecordSchema = z.object({
  id: z.string().min(1),
  token: z.string().min(1),
  holder: z.string().min(1),
  state: z.nativeEnum(KnowledgeQuerySessionState),
  openedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  closedAt: z.string().datetime().optional(),
  renewedAt: z.string().datetime().optional(),
});

export type KnowledgeQuerySessionRecord = z.infer<typeof knowledgeQuerySessionRecordSchema>;
