import { z } from "zod";

import { ExecutionState } from "../state-machine/execution-state.js";
import { executionTokenSchema } from "../token/execution-token.js";

import { executionMetadataSchema } from "./execution-metadata.js";
import { executionModeSchema } from "./execution-mode-schema.js";

/**
 * Everything the Execution Engine carries for one `executeWorkflow()` run —
 * `docs/PROMPT-005.6D-WORKFLOW-EXECUTION-ENGINE.md`'s "ExecutionContext" core component.
 * Wraps the immutable `ExecutionToken` alongside the mutable variable bags, the Execution
 * Mode, and the current `ExecutionState`.
 */
export const executionContextSchema = z.object({
  token: executionTokenSchema,
  mode: executionModeSchema,
  currentState: z.nativeEnum(ExecutionState),
  workflowVariables: z.record(z.string(), z.unknown()),
  environmentVariables: z.record(z.string(), z.unknown()),
  executionVariables: z.record(z.string(), z.unknown()),
  metadata: executionMetadataSchema.optional(),
});

export type ExecutionContext = z.infer<typeof executionContextSchema>;
