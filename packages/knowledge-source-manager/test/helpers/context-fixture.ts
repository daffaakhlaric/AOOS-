import { createKnowledgeSourceContext } from "../../src/context/create-knowledge-source-context.js";
import type { KnowledgeSourceContext } from "../../src/context/knowledge-source-context.js";

export function contextFixture(
  overrides: Partial<KnowledgeSourceContext> & { readonly tenantId?: string } = {},
): KnowledgeSourceContext {
  return createKnowledgeSourceContext({
    tenantId: "tenant-1",
    workspaceId: "workspace-1",
    sourceId: "source-1",
    providerId: "provider-1",
    ...overrides,
  });
}
