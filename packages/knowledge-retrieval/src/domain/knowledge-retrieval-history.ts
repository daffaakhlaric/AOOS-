import { z } from "zod";

import { knowledgeRetrievalStateSchema } from "./knowledge-retrieval-state-schema.js";

/** One recorded state transition — `state-machine/knowledge-retrieval-state-machine.ts` appends one of these on every legal transition. */
export const knowledgeRetrievalHistoryEntrySchema = z.object({
  sequence: z.number().int().nonnegative(),
  fromState: knowledgeRetrievalStateSchema,
  toState: knowledgeRetrievalStateSchema,
  occurredAt: z.string().datetime(),
  reason: z.string().min(1).optional(),
});

export type KnowledgeRetrievalHistoryEntry = z.infer<typeof knowledgeRetrievalHistoryEntrySchema>;

export const knowledgeRetrievalHistorySchema = z.array(knowledgeRetrievalHistoryEntrySchema);
export type KnowledgeRetrievalHistory = z.infer<typeof knowledgeRetrievalHistorySchema>;
