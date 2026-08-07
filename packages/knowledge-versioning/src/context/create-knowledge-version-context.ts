import { generateKnowledgeVersionToken } from "../token/knowledge-version-token.js";

import type { KnowledgeVersionContext } from "./knowledge-version-context.js";

export interface CreateKnowledgeVersionContextInput {
  readonly token?: string;
  readonly versionId: string;
  readonly assetId: string;
  readonly branchId?: string;
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

/** Builds a fresh `KnowledgeVersionContext` — generates `token`/`correlationId` when not supplied. */
export function createKnowledgeVersionContext(
  input: CreateKnowledgeVersionContextInput,
): KnowledgeVersionContext {
  return {
    token: input.token ?? generateKnowledgeVersionToken(),
    versionId: input.versionId,
    assetId: input.assetId,
    branchId: input.branchId,
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
