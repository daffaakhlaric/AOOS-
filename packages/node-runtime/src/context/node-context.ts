import { z } from "zod";

import { executionModeSchema } from "./execution-mode-schema.js";

/**
 * Everything a future Execution Engine (005.6D) needs to execute a Node — this package
 * only assembles and carries the Context, it never reads a variable to make an execution
 * decision itself. Field list per docs/PROMPT-005.6C-ENTERPRISE-NODE-RUNTIME.md — "NODE
 * CONTEXT".
 */
export const nodeContextSchema = z.object({
  tenantId: z.string().optional(),
  workflowInstanceId: z.string().min(1),
  nodeId: z.string().min(1),
  executionId: z.string().min(1),
  traceId: z.string().min(1).optional(),
  correlationId: z.string().min(1),
  input: z.record(z.string(), z.unknown()).optional(),
  output: z.record(z.string(), z.unknown()).optional(),
  variables: z.record(z.string(), z.unknown()),
  metadata: z.record(z.string(), z.unknown()).optional(),
  executionMode: executionModeSchema,
});

export type NodeContext = z.infer<typeof nodeContextSchema>;
