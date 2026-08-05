import { z } from "zod";

import { knowledgeProviderStateSchema } from "./knowledge-provider-state-schema.js";

/** One recorded state transition — `state-machine/knowledge-provider-state-machine.ts` appends one of these on every legal transition. */
export const knowledgeProviderHistoryEntrySchema = z.object({
  sequence: z.number().int().nonnegative(),
  fromState: knowledgeProviderStateSchema,
  toState: knowledgeProviderStateSchema,
  occurredAt: z.string().datetime(),
  reason: z.string().min(1).optional(),
});

export type KnowledgeProviderHistoryEntry = z.infer<typeof knowledgeProviderHistoryEntrySchema>;

export const knowledgeProviderHistorySchema = z.array(knowledgeProviderHistoryEntrySchema);
export type KnowledgeProviderHistory = z.infer<typeof knowledgeProviderHistorySchema>;
