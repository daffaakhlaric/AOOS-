import { generateKnowledgeValidatorToken } from "../token/knowledge-validator-token.js";

import type { KnowledgeValidatorContext } from "./knowledge-validator-context.js";

export interface CreateKnowledgeValidatorContextInput {
  readonly token?: string;
  readonly validationId: string;
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

/** Builds a fresh `KnowledgeValidatorContext` — assigns `token`/`correlationId` when not supplied. */
export function createKnowledgeValidatorContext(
  input: CreateKnowledgeValidatorContextInput,
): KnowledgeValidatorContext {
  return {
    token: input.token ?? generateKnowledgeValidatorToken(),
    validationId: input.validationId,
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
