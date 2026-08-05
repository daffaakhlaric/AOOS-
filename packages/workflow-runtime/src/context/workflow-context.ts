import { z } from "zod";

import { instanceStateSchema } from "../instance/instance-state-schema.js";
import { workflowHistorySchema } from "../instance/workflow-history.js";

import { executionMode as executionModeSchema } from "./execution-mode-schema.js";

/** A free-form variable bag — Workflow/Environment/Execution scopes are a flat `Record<string, unknown>`; Node scope is keyed per Node id. */
const variableBagSchema = z.record(z.string(), z.unknown());

/**
 * Everything a future Node Runtime (005.6C) needs to execute an Instance — this package
 * only assembles and carries the Context, it never reads a variable to make an execution
 * decision itself.
 */
export const workflowContextSchema = z.object({
  tenantId: z.string().optional(),
  correlationId: z.string().min(1),
  traceId: z.string().min(1).optional(),
  workflowVariables: variableBagSchema,
  environmentVariables: variableBagSchema,
  executionVariables: variableBagSchema,
  nodeVariables: z.record(z.string(), variableBagSchema),
  metadata: z.record(z.string(), z.unknown()).optional(),
  input: z.record(z.string(), z.unknown()).optional(),
  output: z.record(z.string(), z.unknown()).optional(),
  executionMode: executionModeSchema,
  currentState: instanceStateSchema,
  executionHistory: workflowHistorySchema,
});

export type WorkflowContext = z.infer<typeof workflowContextSchema>;
