import { executionTokenSchema } from "@aos/workflow-execution";
import { z } from "zod";

import { integrationResultSlotSchema } from "./integration-result-slot.js";

/**
 * "INTEGRATION CONTEXT" (docs/PROMPT-005.6E-WORKFLOW-INTEGRATION.md) — the exact field
 * list from the prompt: ExecutionToken, WorkflowId, WorkflowInstanceId, ExecutionId,
 * TenantId, UserId, Environment, CorrelationId, TraceId, Metadata, Variables, plus one
 * `*Result` slot per future runtime namespace, all populated only after a successful
 * Adapter call for that namespace.
 */
export const workflowIntegrationContextSchema = z.object({
  token: executionTokenSchema,
  workflowId: z.string().min(1),
  workflowInstanceId: z.string().min(1),
  executionId: z.string().min(1),
  tenantId: z.string().optional(),
  userId: z.string().optional(),
  environment: z.string().optional(),
  correlationId: z.string().min(1),
  traceId: z.string().optional(),
  metadata: z.record(z.unknown()),
  variables: z.record(z.unknown()),
  capabilityResult: integrationResultSlotSchema.optional(),
  knowledgeResult: integrationResultSlotSchema.optional(),
  memoryResult: integrationResultSlotSchema.optional(),
  toolResult: integrationResultSlotSchema.optional(),
  connectorResult: integrationResultSlotSchema.optional(),
  modelResult: integrationResultSlotSchema.optional(),
  promptResult: integrationResultSlotSchema.optional(),
  agentResult: integrationResultSlotSchema.optional(),
});

export type WorkflowIntegrationContext = z.infer<typeof workflowIntegrationContextSchema>;
