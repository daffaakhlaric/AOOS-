import { z } from "zod";

import { KnowledgeSourceSessionState } from "./knowledge-source-session-state.js";

/** One open Session over a `KnowledgeSourceToken` — "No persistence": `KnowledgeSourceSession` only ever holds these in memory. */
export const knowledgeSourceSessionRecordSchema = z.object({
  id: z.string().min(1),
  token: z.string().min(1),
  holder: z.string().min(1),
  state: z.nativeEnum(KnowledgeSourceSessionState),
  openedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  closedAt: z.string().datetime().optional(),
  renewedAt: z.string().datetime().optional(),
});

export type KnowledgeSourceSessionRecord = z.infer<typeof knowledgeSourceSessionRecordSchema>;
