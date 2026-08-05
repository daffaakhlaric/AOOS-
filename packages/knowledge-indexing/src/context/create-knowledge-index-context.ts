import type { KnowledgeIndexContext } from "./knowledge-index-context.js";

export interface CreateKnowledgeIndexContextInput {
  readonly assetId: string;
  readonly tenantId: string;
  readonly workspaceId?: string;
  readonly departmentId?: string;
  readonly correlationId?: string;
  readonly traceId?: string;
  readonly environment?: string;
  readonly language?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly variables?: Readonly<Record<string, unknown>>;
}

/** Builds a fresh `KnowledgeIndexContext` — generates `correlationId` when not supplied. */
export function createKnowledgeIndexContext(
  input: CreateKnowledgeIndexContextInput,
): KnowledgeIndexContext {
  return {
    assetId: input.assetId,
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    departmentId: input.departmentId,
    correlationId: input.correlationId ?? crypto.randomUUID(),
    traceId: input.traceId,
    environment: input.environment,
    language: input.language,
    metadata: { ...input.metadata },
    variables: { ...input.variables },
  };
}
