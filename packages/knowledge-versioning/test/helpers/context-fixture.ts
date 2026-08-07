import { createKnowledgeVersionContext } from "../../src/context/create-knowledge-version-context.js";
import type { KnowledgeVersionContext } from "../../src/context/knowledge-version-context.js";

export function contextFixture(
  overrides: Partial<KnowledgeVersionContext> = {},
): KnowledgeVersionContext {
  return createKnowledgeVersionContext({
    tenantId: "tenant-1",
    workspaceId: "workspace-1",
    versionId: "version-1",
    assetId: "asset-1",
    ...overrides,
  });
}
