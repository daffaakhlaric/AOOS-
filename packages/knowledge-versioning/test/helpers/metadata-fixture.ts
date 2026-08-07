import type { KnowledgeVersionMetadata } from "../../src/domain/knowledge-version-metadata.js";
import { KnowledgeVersionType } from "../../src/domain/knowledge-version-type.js";

export function metadataFixture(
  overrides: Partial<KnowledgeVersionMetadata> = {},
): KnowledgeVersionMetadata {
  const now = "2026-01-01T00:00:00.000Z";
  return {
    versionId: "version-1",
    assetId: "asset-1",
    versionName: "Test Version",
    versionType: KnowledgeVersionType.MAJOR,
    versionNumber: "1.0.0",
    tenantId: "tenant-1",
    workspaceId: "workspace-1",
    labels: [],
    tags: [],
    dependencies: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
