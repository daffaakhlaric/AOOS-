import { z } from "zod";

import { KnowledgePolicySessionState } from "./knowledge-policy-session-state.js";

/** One open Session over a `KnowledgePolicyToken` — held in memory only by `KnowledgePolicySession`. */
export const knowledgePolicySessionRecordSchema = z.object({
  id: z.string().min(1),
  token: z.string().min(1),
  holder: z.string().min(1),
  state: z.nativeEnum(KnowledgePolicySessionState),
  openedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  closedAt: z.string().datetime().optional(),
  renewedAt: z.string().datetime().optional(),
});

export type KnowledgePolicySessionRecord = z.infer<typeof knowledgePolicySessionRecordSchema>;
