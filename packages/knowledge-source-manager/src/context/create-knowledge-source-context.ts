import { generateKnowledgeSourceToken } from "../token/knowledge-source-token.js";

import type { KnowledgeSourceContext } from "./knowledge-source-context.js";

export interface CreateKnowledgeSourceContextInput {
  readonly token?: string;
  readonly sourceId: string;
  readonly providerId: string;
  readonly workspaceId?: string;
  readonly tenantId: string;
  readonly organizationId?: string;
  readonly departmentId?: string;
  readonly environment?: string;
  readonly namespace?: string;
  readonly policy?: string;
  readonly permission?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly traceId?: string;
  readonly correlationId?: string;
}

/** Builds a fresh `KnowledgeSourceContext` — generates `token`/`correlationId` when not supplied. */
export function createKnowledgeSourceContext(
  input: CreateKnowledgeSourceContextInput,
): KnowledgeSourceContext {
  return {
    token: input.token ?? generateKnowledgeSourceToken(),
    sourceId: input.sourceId,
    providerId: input.providerId,
    workspaceId: input.workspaceId,
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    departmentId: input.departmentId,
    environment: input.environment,
    namespace: input.namespace,
    policy: input.policy,
    permission: input.permission,
    metadata: { ...input.metadata },
    traceId: input.traceId,
    correlationId: input.correlationId ?? crypto.randomUUID(),
  };
}
