import { z } from "zod";

/** Where an Instance currently is (or was last) in the Workflow Definition's Node graph — structural only, no evaluation. */
export const executionPointerSchema = z.object({
  currentNodeId: z.string().min(1).optional(),
  previousNodeId: z.string().min(1).optional(),
  enteredAt: z.string().datetime().optional(),
});

export type ExecutionPointer = z.infer<typeof executionPointerSchema>;
