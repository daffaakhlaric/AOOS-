import { z } from "zod";

/**
 * "QUERY CONTEXT: ExecutionToken, TraceId, CorrelationId, TenantId, OrganizationId,
 * WorkspaceId, DepartmentId, SolutionPackId, UserId, SessionId, Language, Environment,
 * Permission, Policy, Variables, Metadata." (docs/PROMPT-005.7D-KNOWLEDGE-RETRIEVAL.md)
 * — the exact field list from the prompt.
 */
export const knowledgeQueryContextSchema = z.object({
  token: z.string().min(1),
  traceId: z.string().optional(),
  correlationId: z.string().min(1),
  tenantId: z.string().min(1),
  organizationId: z.string().optional(),
  workspaceId: z.string().optional(),
  departmentId: z.string().optional(),
  solutionPackId: z.string().optional(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  language: z.string().optional(),
  environment: z.string().optional(),
  permission: z.string().optional(),
  policy: z.string().optional(),
  variables: z.record(z.unknown()),
  metadata: z.record(z.unknown()),
});

export type KnowledgeQueryContext = z.infer<typeof knowledgeQueryContextSchema>;
