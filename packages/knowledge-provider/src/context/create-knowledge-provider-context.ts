import type { KnowledgeProviderCategory } from "../domain/knowledge-provider-category.js";
import { generateKnowledgeProviderToken } from "../token/knowledge-provider-token.js";

import type { KnowledgeProviderContext } from "./knowledge-provider-context.js";

export interface CreateKnowledgeProviderContextInput {
  readonly token?: string;
  readonly tenantId: string;
  readonly workspaceId?: string;
  readonly departmentId?: string;
  readonly environment?: string;
  readonly providerId: string;
  readonly providerType: KnowledgeProviderCategory;
  readonly providerVersion?: string;
  readonly sourceId?: string;
  readonly sessionId?: string;
  readonly namespace?: string;
  readonly policy?: string;
  readonly permission?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly traceId?: string;
  readonly correlationId?: string;
}

/** Builds a fresh `KnowledgeProviderContext` — generates `token`/`correlationId` when not supplied. */
export function createKnowledgeProviderContext(
  input: CreateKnowledgeProviderContextInput,
): KnowledgeProviderContext {
  return {
    token: input.token ?? generateKnowledgeProviderToken(),
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    departmentId: input.departmentId,
    environment: input.environment,
    providerId: input.providerId,
    providerType: input.providerType,
    providerVersion: input.providerVersion,
    sourceId: input.sourceId,
    sessionId: input.sessionId,
    namespace: input.namespace,
    policy: input.policy,
    permission: input.permission,
    metadata: { ...input.metadata },
    traceId: input.traceId,
    correlationId: input.correlationId ?? crypto.randomUUID(),
  };
}
