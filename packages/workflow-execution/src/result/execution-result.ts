import { z } from "zod";

/** The final outcome of one `executeWorkflow()` run. */
export const executionResultSchema = z.object({
  success: z.boolean(),
  output: z.record(z.string(), z.unknown()).optional(),
  error: z.string().min(1).optional(),
  completedAt: z.string().datetime().optional(),
  nodesVisited: z.array(z.string().min(1)),
});

export type ExecutionResult = z.infer<typeof executionResultSchema>;
