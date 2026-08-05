import { z } from "zod";

import { NodeState } from "../contracts/node-state.js";

const nodeStateSchema = z.nativeEnum(NodeState);

/** One recorded state transition — `lifecycle/node-state-machine.ts` appends one of these on every legal transition. */
export const nodeHistoryEntrySchema = z.object({
  sequence: z.number().int().nonnegative(),
  fromState: nodeStateSchema,
  toState: nodeStateSchema,
  occurredAt: z.string().datetime(),
  reason: z.string().min(1).optional(),
});

export type NodeHistoryEntry = z.infer<typeof nodeHistoryEntrySchema>;

/** The ordered log of every state transition a Node Instance has undergone. */
export const nodeHistorySchema = z.array(nodeHistoryEntrySchema);
export type NodeHistory = z.infer<typeof nodeHistorySchema>;
