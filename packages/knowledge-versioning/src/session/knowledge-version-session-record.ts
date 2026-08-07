import { z } from "zod";

import { KnowledgeVersionSessionState } from "./knowledge-version-session-state.js";

/** One open Session over a `KnowledgeVersionToken` — held in memory only by `KnowledgeVersionSession`. */
export const knowledgeVersionSessionRecordSchema = z.object({
  id: z.string().min(1),
  token: z.string().min(1),
  holder: z.string().min(1),
  state: z.nativeEnum(KnowledgeVersionSessionState),
  openedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  closedAt: z.string().datetime().optional(),
  renewedAt: z.string().datetime().optional(),
});

export type KnowledgeVersionSessionRecord = z.infer<typeof knowledgeVersionSessionRecordSchema>;
