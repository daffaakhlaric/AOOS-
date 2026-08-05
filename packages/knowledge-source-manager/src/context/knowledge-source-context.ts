import { z } from "zod";

/**
 * "SOURCE CONTEXT: ExecutionToken, SourceId, ProviderId, WorkspaceId, TenantId,
 * OrganizationId, DepartmentId, Environment, Namespace, Policy, Permission, Metadata,
 * TraceId, CorrelationId." (docs/PROMPT-005.7G-KNOWLEDGE-SOURCE-MANAGER.md) — the exact
 * 14-field list from the prompt. `token` is the `ExecutionToken` field the prompt names.
 */
export const knowledgeSourceContextSchema = z.object({
  token: z.string().min(1),
  sourceId: z.string().min(1),
  providerId: z.string().min(1),
  workspaceId: z.string().optional(),
  tenantId: z.string().min(1),
  organizationId: z.string().optional(),
  departmentId: z.string().optional(),
  environment: z.string().optional(),
  namespace: z.string().optional(),
  policy: z.string().optional(),
  permission: z.string().optional(),
  metadata: z.record(z.unknown()),
  traceId: z.string().optional(),
  correlationId: z.string().min(1),
});

export type KnowledgeSourceContext = z.infer<typeof knowledgeSourceContextSchema>;
