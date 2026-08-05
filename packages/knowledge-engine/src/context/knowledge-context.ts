import { executionTokenSchema } from "@aos/workflow-execution";
import { z } from "zod";

/**
 * "CONTEXT: KnowledgeContext. Contains KnowledgeId, TenantId, WorkspaceId,
 * OrganizationId, DepartmentId, UserId, Environment, TraceId, CorrelationId,
 * ExecutionToken, Language, Metadata, Permission, Policy, Labels, Tags, Variables."
 * (docs/PROMPT-005.7A-KNOWLEDGE-ENGINE.md) — the exact field list from the prompt.
 * `permissions`/`policies` carry the ids of the `KnowledgePermission`/`KnowledgePolicy`
 * entries currently in effect for this operation.
 */
export const knowledgeContextSchema = z.object({
  token: executionTokenSchema,
  knowledgeId: z.string().optional(),
  tenantId: z.string().min(1),
  workspaceId: z.string().optional(),
  organizationId: z.string().optional(),
  departmentId: z.string().optional(),
  userId: z.string().optional(),
  environment: z.string().optional(),
  traceId: z.string().optional(),
  correlationId: z.string().min(1),
  language: z.string().optional(),
  metadata: z.record(z.unknown()),
  permissions: z.array(z.string()),
  policies: z.array(z.string()),
  labels: z.array(z.string()),
  tags: z.array(z.string()),
  variables: z.record(z.unknown()),
});

export type KnowledgeContext = z.infer<typeof knowledgeContextSchema>;
