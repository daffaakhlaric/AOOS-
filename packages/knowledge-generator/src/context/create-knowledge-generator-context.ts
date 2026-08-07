import { generateKnowledgeGeneratorToken } from "../token/knowledge-generator-token.js";

import type { KnowledgeGeneratorContext } from "./knowledge-generator-context.js";

export interface CreateKnowledgeGeneratorContextInput {
  readonly token?: string;
  readonly generationId: string;
  readonly tenantId: string;
  readonly organizationId?: string;
  readonly workspaceId?: string;
  readonly departmentId?: string;
  readonly environment?: string;
  readonly namespace?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly traceId?: string;
  readonly correlationId?: string;
}

/** Builds a fresh `KnowledgeGeneratorContext` — generates `token`/`correlationId` when not supplied. */
export function createKnowledgeGeneratorContext(
  input: CreateKnowledgeGeneratorContextInput,
): KnowledgeGeneratorContext {
  return {
    token: input.token ?? generateKnowledgeGeneratorToken(),
    generationId: input.generationId,
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    workspaceId: input.workspaceId,
    departmentId: input.departmentId,
    environment: input.environment,
    namespace: input.namespace,
    metadata: { ...input.metadata },
    traceId: input.traceId,
    correlationId: input.correlationId ?? crypto.randomUUID(),
  };
}
