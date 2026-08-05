import { z } from "zod";

import { KnowledgeSynchronizationProviderType } from "../domain/knowledge-synchronization-provider-type.js";

/**
 * "SYNCHRONIZATION CONTEXT: SynchronizationId, ExecutionToken, TenantId, WorkspaceId,
 * OrganizationId, DepartmentId, ProviderId, SourceId, SourceType, KnowledgeCollection,
 * Namespace, Version, Policy, Permission, Environment, Metadata, TraceId, CorrelationId."
 * (docs/PROMPT-005.7E-KNOWLEDGE-SYNCHRONIZATION.md) — the exact field list from the
 * prompt. `synchronizationId` identifies the logical Synchronization the Context was
 * built for; `token` is the `ExecutionToken` field the prompt names.
 */
export const knowledgeSynchronizationContextSchema = z.object({
  synchronizationId: z.string().min(1),
  token: z.string().min(1),
  tenantId: z.string().min(1),
  workspaceId: z.string().optional(),
  organizationId: z.string().optional(),
  departmentId: z.string().optional(),
  providerId: z.string().min(1),
  sourceId: z.string().min(1),
  sourceType: z.nativeEnum(KnowledgeSynchronizationProviderType),
  collection: z.string().optional(),
  namespace: z.string().optional(),
  version: z.string().optional(),
  policy: z.string().optional(),
  permission: z.string().optional(),
  environment: z.string().optional(),
  metadata: z.record(z.unknown()),
  traceId: z.string().optional(),
  correlationId: z.string().min(1),
});

export type KnowledgeSynchronizationContext = z.infer<typeof knowledgeSynchronizationContextSchema>;
