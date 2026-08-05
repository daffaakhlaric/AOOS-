import { z } from "zod";

import { knowledgeRuntimeStateSchema } from "./knowledge-runtime-state-schema.js";

/** One recorded state transition — `state-machine/knowledge-runtime-state-machine.ts` appends one of these on every legal transition. */
export const knowledgeRuntimeHistoryEntrySchema = z.object({
  sequence: z.number().int().nonnegative(),
  fromState: knowledgeRuntimeStateSchema,
  toState: knowledgeRuntimeStateSchema,
  occurredAt: z.string().datetime(),
  reason: z.string().min(1).optional(),
});

export type KnowledgeRuntimeHistoryEntry = z.infer<typeof knowledgeRuntimeHistoryEntrySchema>;

/** The ordered log of every state transition a `KnowledgeRuntimeInstance` has undergone. */
export const knowledgeRuntimeHistorySchema = z.array(knowledgeRuntimeHistoryEntrySchema);
export type KnowledgeRuntimeHistory = z.infer<typeof knowledgeRuntimeHistorySchema>;
