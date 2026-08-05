import type { KnowledgeScope } from "@aos/knowledge-engine";

import { generateKnowledgeRuntimeToken } from "../token/knowledge-runtime-token.js";

import type { KnowledgeRuntimeContext } from "./knowledge-runtime-context.js";

export interface CreateKnowledgeRuntimeContextInput {
  readonly knowledgeId: string;
  readonly tenantId: string;
  readonly runtimeId?: string;
  readonly token?: string;
  readonly workspaceId?: string;
  readonly organizationId?: string;
  readonly departmentId?: string;
  readonly sessionId?: string;
  readonly traceId?: string;
  readonly correlationId?: string;
  readonly environment?: string;
  readonly language?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly permission?: string;
  readonly policy?: string;
  readonly variables?: Readonly<Record<string, unknown>>;
  readonly executionScope?: KnowledgeScope;
}

/** Builds a fresh `KnowledgeRuntimeContext` — generates `runtimeId`/`token`/`correlationId` when not supplied. */
export function createKnowledgeRuntimeContext(
  input: CreateKnowledgeRuntimeContextInput,
): KnowledgeRuntimeContext {
  return {
    knowledgeId: input.knowledgeId,
    runtimeId: input.runtimeId ?? crypto.randomUUID(),
    token: input.token ?? generateKnowledgeRuntimeToken(),
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    organizationId: input.organizationId,
    departmentId: input.departmentId,
    sessionId: input.sessionId,
    traceId: input.traceId,
    correlationId: input.correlationId ?? crypto.randomUUID(),
    environment: input.environment,
    language: input.language,
    metadata: { ...input.metadata },
    permission: input.permission,
    policy: input.policy,
    variables: { ...input.variables },
    executionScope: input.executionScope ?? {
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
    },
  };
}
