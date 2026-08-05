import type { KnowledgeSynchronizationProviderType } from "../domain/knowledge-synchronization-provider-type.js";
import { generateKnowledgeSynchronizationToken } from "../token/knowledge-synchronization-token.js";

import type { KnowledgeSynchronizationContext } from "./knowledge-synchronization-context.js";

export interface CreateKnowledgeSynchronizationContextInput {
  readonly synchronizationId?: string;
  readonly token?: string;
  readonly tenantId: string;
  readonly workspaceId?: string;
  readonly organizationId?: string;
  readonly departmentId?: string;
  readonly providerId: string;
  readonly sourceId: string;
  readonly sourceType: KnowledgeSynchronizationProviderType;
  readonly collection?: string;
  readonly namespace?: string;
  readonly version?: string;
  readonly policy?: string;
  readonly permission?: string;
  readonly environment?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly traceId?: string;
  readonly correlationId?: string;
}

/** Builds a fresh `KnowledgeSynchronizationContext` — generates `synchronizationId`/`token`/`correlationId` when not supplied. */
export function createKnowledgeSynchronizationContext(
  input: CreateKnowledgeSynchronizationContextInput,
): KnowledgeSynchronizationContext {
  return {
    synchronizationId: input.synchronizationId ?? crypto.randomUUID(),
    token: input.token ?? generateKnowledgeSynchronizationToken(),
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    organizationId: input.organizationId,
    departmentId: input.departmentId,
    providerId: input.providerId,
    sourceId: input.sourceId,
    sourceType: input.sourceType,
    collection: input.collection,
    namespace: input.namespace,
    version: input.version,
    policy: input.policy,
    permission: input.permission,
    environment: input.environment,
    metadata: { ...input.metadata },
    traceId: input.traceId,
    correlationId: input.correlationId ?? crypto.randomUUID(),
  };
}
