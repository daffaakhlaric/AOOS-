import type { ExecutionToken } from "@aos/workflow-execution";

import type { KnowledgeContext } from "./knowledge-context.js";

export interface CreateKnowledgeContextInput {
  readonly token: ExecutionToken;
  readonly tenantId: string;
  readonly knowledgeId?: string;
  readonly workspaceId?: string;
  readonly organizationId?: string;
  readonly departmentId?: string;
  readonly userId?: string;
  readonly environment?: string;
  readonly language?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly permissions?: readonly string[];
  readonly policies?: readonly string[];
  readonly labels?: readonly string[];
  readonly tags?: readonly string[];
  readonly variables?: Readonly<Record<string, unknown>>;
}

/** Builds a fresh `KnowledgeContext` — `correlationId`/`traceId` are read straight off the `ExecutionToken`. */
export function createKnowledgeContext(input: CreateKnowledgeContextInput): KnowledgeContext {
  return {
    token: input.token,
    knowledgeId: input.knowledgeId,
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    organizationId: input.organizationId,
    departmentId: input.departmentId,
    userId: input.userId,
    environment: input.environment,
    traceId: input.token.traceId,
    correlationId: input.token.correlationId,
    language: input.language,
    metadata: { ...input.metadata },
    permissions: [...(input.permissions ?? [])],
    policies: [...(input.policies ?? [])],
    labels: [...(input.labels ?? [])],
    tags: [...(input.tags ?? [])],
    variables: { ...input.variables },
  };
}
