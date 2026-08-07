import { generateEmbeddingManagerToken } from "../token/embedding-manager-token.js";

import type { EmbeddingContext } from "./embedding-context.js";

export interface CreateEmbeddingContextInput {
  readonly token?: string;
  readonly embeddingId: string;
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

/** Builds a fresh `EmbeddingContext` — assigns `token`/`correlationId` when not supplied. */
export function createEmbeddingContext(input: CreateEmbeddingContextInput): EmbeddingContext {
  return {
    token: input.token ?? generateEmbeddingManagerToken(),
    embeddingId: input.embeddingId,
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
