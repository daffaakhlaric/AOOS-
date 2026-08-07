import { z } from "zod";

import { KnowledgeQualitySessionState } from "../domain/knowledge-quality-session-state.js";

export const knowledgeQualitySessionRecordSchema = z.object({
  id: z.string().min(1),
  token: z.string().min(1),
  holder: z.string().min(1),
  state: z.nativeEnum(KnowledgeQualitySessionState),
  openedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  closedAt: z.string().datetime().optional(),
  renewedAt: z.string().datetime().optional(),
});

export type KnowledgeQualitySessionRecord = z.infer<typeof knowledgeQualitySessionRecordSchema>;
