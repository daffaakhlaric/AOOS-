import { z } from "zod";

import { ExecutionState } from "../state-machine/execution-state.js";

const executionStateSchema = z.nativeEnum(ExecutionState);

/** One recorded Execution State transition — `state-machine/execution-state-machine.ts` appends one of these on every legal transition. */
export const executionHistoryEntrySchema = z.object({
  sequence: z.number().int().nonnegative(),
  fromState: executionStateSchema,
  toState: executionStateSchema,
  occurredAt: z.string().datetime(),
  nodeId: z.string().min(1).optional(),
  reason: z.string().min(1).optional(),
});

export type ExecutionHistoryEntry = z.infer<typeof executionHistoryEntrySchema>;

export const executionHistorySchema = z.array(executionHistoryEntrySchema);
export type ExecutionHistory = z.infer<typeof executionHistorySchema>;
