import { z } from "zod";

import { instanceStateSchema } from "./instance-state-schema.js";

/** One recorded state transition — `state-machine/workflow-state-machine.ts` appends one of these on every legal transition. */
export const workflowHistoryEntrySchema = z.object({
  sequence: z.number().int().nonnegative(),
  fromState: instanceStateSchema,
  toState: instanceStateSchema,
  occurredAt: z.string().datetime(),
  reason: z.string().min(1).optional(),
});

export type WorkflowHistoryEntry = z.infer<typeof workflowHistoryEntrySchema>;

/** The ordered log of every state transition an Instance has undergone. */
export const workflowHistorySchema = z.array(workflowHistoryEntrySchema);
export type WorkflowHistory = z.infer<typeof workflowHistorySchema>;
