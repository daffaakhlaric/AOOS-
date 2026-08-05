import { createKnowledgeSynchronizationContext } from "../../src/context/create-knowledge-synchronization-context.js";
import type { KnowledgeSynchronizationContext } from "../../src/context/knowledge-synchronization-context.js";
import { KnowledgeSynchronizationProviderType } from "../../src/domain/knowledge-synchronization-provider-type.js";

export function contextFixture(
  overrides: Partial<KnowledgeSynchronizationContext> & { readonly tenantId?: string } = {},
): KnowledgeSynchronizationContext {
  return createKnowledgeSynchronizationContext({
    tenantId: "tenant-1",
    workspaceId: "workspace-1",
    providerId: "provider-1",
    sourceId: "source-1",
    sourceType: KnowledgeSynchronizationProviderType.DOCUMENT,
    ...overrides,
  });
}
