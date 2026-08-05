import { z } from "zod";

import { KnowledgeSynchronizationSessionState } from "./knowledge-synchronization-session-state.js";

/** One open Session over a `KnowledgeSynchronizationToken` — "No persistence": `KnowledgeSynchronizationSession` only ever holds these in memory. */
export const knowledgeSynchronizationSessionRecordSchema = z.object({
  id: z.string().min(1),
  token: z.string().min(1),
  holder: z.string().min(1),
  state: z.nativeEnum(KnowledgeSynchronizationSessionState),
  openedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  closedAt: z.string().datetime().optional(),
  renewedAt: z.string().datetime().optional(),
});

export type KnowledgeSynchronizationSessionRecord = z.infer<
  typeof knowledgeSynchronizationSessionRecordSchema
>;
