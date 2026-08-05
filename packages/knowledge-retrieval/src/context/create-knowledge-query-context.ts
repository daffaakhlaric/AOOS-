import { generateKnowledgeRetrievalToken } from "../token/knowledge-retrieval-token.js";

import type { KnowledgeQueryContext } from "./knowledge-query-context.js";

export interface CreateKnowledgeQueryContextInput {
  readonly tenantId: string;
  readonly token?: string;
  readonly traceId?: string;
  readonly correlationId?: string;
  readonly organizationId?: string;
  readonly workspaceId?: string;
  readonly departmentId?: string;
  readonly solutionPackId?: string;
  readonly userId?: string;
  readonly sessionId?: string;
  readonly language?: string;
  readonly environment?: string;
  readonly permission?: string;
  readonly policy?: string;
  readonly variables?: Readonly<Record<string, unknown>>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/** Builds a fresh `KnowledgeQueryContext` — generates `token`/`correlationId` when not supplied. */
export function createKnowledgeQueryContext(
  input: CreateKnowledgeQueryContextInput,
): KnowledgeQueryContext {
  return {
    token: input.token ?? generateKnowledgeRetrievalToken(),
    traceId: input.traceId,
    correlationId: input.correlationId ?? crypto.randomUUID(),
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    workspaceId: input.workspaceId,
    departmentId: input.departmentId,
    solutionPackId: input.solutionPackId,
    userId: input.userId,
    sessionId: input.sessionId,
    language: input.language,
    environment: input.environment,
    permission: input.permission,
    policy: input.policy,
    variables: { ...input.variables },
    metadata: { ...input.metadata },
  };
}
