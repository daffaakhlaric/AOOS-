import { generateKnowledgePolicyToken } from "../token/knowledge-policy-token.js";

import type { KnowledgePolicyContext } from "./knowledge-policy-context.js";

export interface CreateKnowledgePolicyContextInput {
  readonly token?: string;
  readonly policyId: string;
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

/** Builds a fresh `KnowledgePolicyContext` — generates `token`/`correlationId` when not supplied. */
export function createKnowledgePolicyContext(
  input: CreateKnowledgePolicyContextInput,
): KnowledgePolicyContext {
  return {
    token: input.token ?? generateKnowledgePolicyToken(),
    policyId: input.policyId,
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
