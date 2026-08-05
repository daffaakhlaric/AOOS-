import { z } from "zod";

import { knowledgeSourceStateSchema } from "./knowledge-source-state-schema.js";

/** One recorded state transition — `state-machine/knowledge-source-state-machine.ts` appends one of these on every legal transition. */
export const knowledgeSourceHistoryEntrySchema = z.object({
  sequence: z.number().int().nonnegative(),
  fromState: knowledgeSourceStateSchema,
  toState: knowledgeSourceStateSchema,
  occurredAt: z.string().datetime(),
  reason: z.string().min(1).optional(),
});

export type KnowledgeSourceHistoryEntry = z.infer<typeof knowledgeSourceHistoryEntrySchema>;

export const knowledgeSourceHistorySchema = z.array(knowledgeSourceHistoryEntrySchema);
export type KnowledgeSourceHistory = z.infer<typeof knowledgeSourceHistorySchema>;
