import { z } from "zod";

/**
 * "Every execution has immutable ExecutionToken." (docs/PROMPT-005.6D-WORKFLOW-EXECUTION-ENGINE.md
 * — "EXECUTION TOKEN"). Every field is `readonly`; `token/create-execution-token.ts` is the
 * only place one is ever constructed — nothing in this package mutates a token after
 * creation.
 */
export const executionTokenSchema = z.object({
  workflowExecutionId: z.string().min(1),
  tenantId: z.string().optional(),
  workflowInstanceId: z.string().min(1),
  executionId: z.string().min(1),
  startedAt: z.string().datetime(),
  traceId: z.string().min(1).optional(),
  correlationId: z.string().min(1),
});

export type ExecutionToken = z.infer<typeof executionTokenSchema>;
