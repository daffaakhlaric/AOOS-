import { createKnowledgeProviderContext } from "../../src/context/create-knowledge-provider-context.js";
import type { KnowledgeProviderContext } from "../../src/context/knowledge-provider-context.js";
import { KnowledgeProviderCategory } from "../../src/domain/knowledge-provider-category.js";

export function contextFixture(
  overrides: Partial<KnowledgeProviderContext> & { readonly tenantId?: string } = {},
): KnowledgeProviderContext {
  return createKnowledgeProviderContext({
    tenantId: "tenant-1",
    workspaceId: "workspace-1",
    providerId: "provider-1",
    providerType: KnowledgeProviderCategory.DOCUMENT,
    ...overrides,
  });
}
