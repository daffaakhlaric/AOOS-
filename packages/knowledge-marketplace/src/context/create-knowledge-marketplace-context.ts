import { generateKnowledgeMarketplaceToken } from "../token/knowledge-marketplace-token.js";

import type { KnowledgeMarketplaceContext } from "./knowledge-marketplace-context.js";

export interface CreateKnowledgeMarketplaceContextInput {
  readonly token?: string;
  readonly listingId: string;
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

/** Builds a fresh `KnowledgeMarketplaceContext` — generates `token`/`correlationId` when not supplied. */
export function createKnowledgeMarketplaceContext(
  input: CreateKnowledgeMarketplaceContextInput,
): KnowledgeMarketplaceContext {
  return {
    token: input.token ?? generateKnowledgeMarketplaceToken(),
    listingId: input.listingId,
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
