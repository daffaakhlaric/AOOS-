import { z } from "zod";

import { KnowledgeMarketplaceSessionState } from "./knowledge-marketplace-session-state.js";

export const knowledgeMarketplaceSessionRecordSchema = z.object({
  id: z.string().min(1),
  token: z.string().min(1),
  holder: z.string().min(1),
  state: z.nativeEnum(KnowledgeMarketplaceSessionState),
  openedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  closedAt: z.string().datetime().optional(),
  renewedAt: z.string().datetime().optional(),
});

export type KnowledgeMarketplaceSessionRecord = z.infer<
  typeof knowledgeMarketplaceSessionRecordSchema
>;
