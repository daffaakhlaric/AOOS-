import { generateKnowledgeQualityToken } from "../token/knowledge-quality-token.js";

import type { KnowledgeQualityContext } from "./knowledge-quality-context.js";

export interface CreateKnowledgeQualityContextInput {
  readonly token?: string;
  readonly assessmentId: string;
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

/** Builds a fresh `KnowledgeQualityContext` — assesses `token`/`correlationId` when not supplied. */
export function createKnowledgeQualityContext(
  input: CreateKnowledgeQualityContextInput,
): KnowledgeQualityContext {
  return {
    token: input.token ?? generateKnowledgeQualityToken(),
    assessmentId: input.assessmentId,
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
