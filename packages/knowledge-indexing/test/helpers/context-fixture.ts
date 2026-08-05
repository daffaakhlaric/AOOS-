import type { KnowledgeAsset } from "@aos/knowledge-engine";

import { createKnowledgeIndexContext } from "../../src/context/create-knowledge-index-context.js";
import type { KnowledgeIndexContext } from "../../src/context/knowledge-index-context.js";

export function contextFixture(
  asset: KnowledgeAsset,
  overrides: Partial<KnowledgeIndexContext> = {},
): KnowledgeIndexContext {
  return createKnowledgeIndexContext({
    assetId: asset.id,
    tenantId: asset.scope.tenantId,
    workspaceId: asset.scope.workspaceId,
    ...overrides,
  });
}
