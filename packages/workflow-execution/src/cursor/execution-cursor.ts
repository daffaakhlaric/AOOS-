import { z } from "zod";

/**
 * "ExecutionCursor determines Current Node, Previous Node, Next Node, Visited Nodes,
 * Execution Path." (docs/PROMPT-005.6D-WORKFLOW-EXECUTION-ENGINE.md — "CURSOR"). Every
 * field is `readonly`; `cursor/advance-cursor.ts` returns a new Cursor rather than
 * mutating one in place.
 */
export const executionCursorSchema = z.object({
  currentNodeId: z.string().min(1),
  previousNodeId: z.string().min(1).optional(),
  nextNodeIds: z.array(z.string().min(1)),
  visitedNodes: z.array(z.string().min(1)),
  executionPath: z.array(z.string().min(1)),
  loopIterations: z.record(z.string(), z.number().int().nonnegative()),
});

export type ExecutionCursor = z.infer<typeof executionCursorSchema>;
