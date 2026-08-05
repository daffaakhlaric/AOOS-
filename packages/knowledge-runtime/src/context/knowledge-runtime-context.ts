import { knowledgeScopeSchema } from "@aos/knowledge-engine";
import { z } from "zod";

/**
 * "RUNTIME CONTEXT: Contains KnowledgeId, RuntimeId, ExecutionToken, TenantId,
 * WorkspaceId, OrganizationId, DepartmentId, SessionId, TraceId, CorrelationId,
 * Environment, Language, Metadata, Permission, Policy, Variables, ExecutionScope."
 * (docs/PROMPT-005.7B-KNOWLEDGE-RUNTIME.md) — the exact field list from the prompt.
 */
export const knowledgeRuntimeContextSchema = z.object({
  knowledgeId: z.string().min(1),
  runtimeId: z.string().min(1),
  token: z.string().min(1),
  tenantId: z.string().min(1),
  workspaceId: z.string().optional(),
  organizationId: z.string().optional(),
  departmentId: z.string().optional(),
  sessionId: z.string().optional(),
  traceId: z.string().optional(),
  correlationId: z.string().min(1),
  environment: z.string().optional(),
  language: z.string().optional(),
  metadata: z.record(z.unknown()),
  permission: z.string().optional(),
  policy: z.string().optional(),
  variables: z.record(z.unknown()),
  executionScope: knowledgeScopeSchema,
});

export type KnowledgeRuntimeContext = z.infer<typeof knowledgeRuntimeContextSchema>;
