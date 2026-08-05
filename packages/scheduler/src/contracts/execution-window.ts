import { z } from "zod";

/** Execution Window — a Job may only actually run inside this window, independent of when it becomes Ready. */
export const executionWindowSchema = z.object({
  earliestAt: z.string().min(1).optional(),
  latestAt: z.string().min(1).optional(),
});

export type ExecutionWindow = z.infer<typeof executionWindowSchema>;
