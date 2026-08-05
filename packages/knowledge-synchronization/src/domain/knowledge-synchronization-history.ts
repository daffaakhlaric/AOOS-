import { z } from "zod";

import { knowledgeSynchronizationStateSchema } from "./knowledge-synchronization-state-schema.js";

/** One recorded state transition — `state-machine/knowledge-synchronization-state-machine.ts` appends one of these on every legal transition. */
export const knowledgeSynchronizationHistoryEntrySchema = z.object({
  sequence: z.number().int().nonnegative(),
  fromState: knowledgeSynchronizationStateSchema,
  toState: knowledgeSynchronizationStateSchema,
  occurredAt: z.string().datetime(),
  reason: z.string().min(1).optional(),
});

export type KnowledgeSynchronizationHistoryEntry = z.infer<
  typeof knowledgeSynchronizationHistoryEntrySchema
>;

export const knowledgeSynchronizationHistorySchema = z.array(
  knowledgeSynchronizationHistoryEntrySchema,
);
export type KnowledgeSynchronizationHistory = z.infer<typeof knowledgeSynchronizationHistorySchema>;
