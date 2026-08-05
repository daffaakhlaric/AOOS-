import { KnowledgeSourceCategory } from "../../src/domain/knowledge-source-category.js";
import type { KnowledgeSourceMetadataRecord } from "../../src/domain/knowledge-source-metadata-record.js";

export function metadataFixture(
  overrides: Partial<KnowledgeSourceMetadataRecord> = {},
): KnowledgeSourceMetadataRecord {
  const now = "2026-01-01T00:00:00.000Z";
  return {
    sourceId: "source-1",
    sourceName: "Test Source",
    sourceCategory: KnowledgeSourceCategory.DOCUMENT,
    sourceProvider: "Google Drive",
    providerId: "provider-1",
    tenantId: "tenant-1",
    workspaceId: "workspace-1",
    labels: [],
    tags: [],
    priority: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
