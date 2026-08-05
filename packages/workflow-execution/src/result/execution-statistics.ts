import { z } from "zod";

/** Aggregate counters over one Execution Session's Node traversal. */
export const executionStatisticsSchema = z.object({
  totalNodes: z.number().int().nonnegative(),
  completedNodes: z.number().int().nonnegative(),
  failedNodes: z.number().int().nonnegative(),
  retriedNodes: z.number().int().nonnegative(),
  skippedNodes: z.number().int().nonnegative(),
  totalDurationMs: z.number().nonnegative(),
});

export type ExecutionStatistics = z.infer<typeof executionStatisticsSchema>;

export const EMPTY_EXECUTION_STATISTICS: ExecutionStatistics = {
  totalNodes: 0,
  completedNodes: 0,
  failedNodes: 0,
  retriedNodes: 0,
  skippedNodes: 0,
  totalDurationMs: 0,
};
