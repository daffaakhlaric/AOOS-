import { z } from "zod";

import { KnowledgeProviderSessionState } from "./knowledge-provider-session-state.js";

/** One open Session over a `KnowledgeProviderToken` — "No persistence": `KnowledgeProviderSession` only ever holds these in memory. */
export const knowledgeProviderSessionRecordSchema = z.object({
  id: z.string().min(1),
  token: z.string().min(1),
  holder: z.string().min(1),
  state: z.nativeEnum(KnowledgeProviderSessionState),
  openedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  closedAt: z.string().datetime().optional(),
  renewedAt: z.string().datetime().optional(),
});

export type KnowledgeProviderSessionRecord = z.infer<typeof knowledgeProviderSessionRecordSchema>;
