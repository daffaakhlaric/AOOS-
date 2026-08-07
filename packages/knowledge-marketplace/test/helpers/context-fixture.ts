import { createKnowledgeMarketplaceContext } from "../../src/context/create-knowledge-marketplace-context.js";
import type { KnowledgeMarketplaceContext } from "../../src/context/knowledge-marketplace-context.js";

export function contextFixture(
  overrides: Partial<KnowledgeMarketplaceContext> = {},
): KnowledgeMarketplaceContext {
  return createKnowledgeMarketplaceContext({
    tenantId: "tenant-1",
    workspaceId: "workspace-1",
    listingId: "listing-1",
    ...overrides,
  });
}
