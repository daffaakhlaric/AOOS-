import { createKnowledgeQueryContext } from "../../src/context/create-knowledge-query-context.js";
import type { KnowledgeQueryContext } from "../../src/context/knowledge-query-context.js";

export function contextFixture(
  overrides: Partial<KnowledgeQueryContext> & { readonly tenantId?: string } = {},
): KnowledgeQueryContext {
  return createKnowledgeQueryContext({
    tenantId: "tenant-1",
    workspaceId: "workspace-1",
    ...overrides,
  });
}
