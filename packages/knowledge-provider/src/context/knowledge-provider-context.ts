import { z } from "zod";

import { KnowledgeProviderCategory } from "../domain/knowledge-provider-category.js";

/**
 * "PROVIDER CONTEXT: ExecutionToken, TenantId, WorkspaceId, DepartmentId, Environment,
 * ProviderId, ProviderType, ProviderVersion, SourceId, SessionId, Namespace, Policy,
 * Permission, Metadata, TraceId, CorrelationId." (docs/PROMPT-005.7F-KNOWLEDGE-PROVIDER.md)
 * — the exact field list from the prompt. `token` is the `ExecutionToken` field the
 * prompt names; `providerType` reuses `KnowledgeProviderCategory`.
 */
export const knowledgeProviderContextSchema = z.object({
  token: z.string().min(1),
  tenantId: z.string().min(1),
  workspaceId: z.string().optional(),
  departmentId: z.string().optional(),
  environment: z.string().optional(),
  providerId: z.string().min(1),
  providerType: z.nativeEnum(KnowledgeProviderCategory),
  providerVersion: z.string().optional(),
  sourceId: z.string().optional(),
  sessionId: z.string().optional(),
  namespace: z.string().optional(),
  policy: z.string().optional(),
  permission: z.string().optional(),
  metadata: z.record(z.unknown()),
  traceId: z.string().optional(),
  correlationId: z.string().min(1),
});

export type KnowledgeProviderContext = z.infer<typeof knowledgeProviderContextSchema>;
