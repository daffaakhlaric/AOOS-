import { describe, expect, it } from "vitest";

import { knowledgeChunkReferenceSchema } from "../../src/domain/knowledge-chunk-reference.js";
import { knowledgeEmbeddingReferenceSchema } from "../../src/domain/knowledge-embedding-reference.js";
import { knowledgeIndexEntrySchema } from "../../src/domain/knowledge-index-entry.js";
import {
  EMPTY_KNOWLEDGE_INDEX_STATISTICS,
  knowledgeIndexStatisticsSnapshotSchema,
} from "../../src/domain/knowledge-index-statistics-snapshot.js";
import { KnowledgeIndexType } from "../../src/domain/knowledge-index-type.js";
import {
  bumpKnowledgeIndexVersion,
  createKnowledgeIndexVersion,
  formatKnowledgeIndexVersion,
  knowledgeIndexVersionSchema,
} from "../../src/domain/knowledge-index-version.js";

describe("Domain Test — schemas", () => {
  it("knowledgeChunkReferenceSchema accepts a valid reference", () => {
    const result = knowledgeChunkReferenceSchema.safeParse({
      id: "c-1",
      assetId: "a-1",
      sequence: 0,
      externalRef: "ref-1",
      createdAt: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });

  it("knowledgeEmbeddingReferenceSchema accepts a valid reference", () => {
    const result = knowledgeEmbeddingReferenceSchema.safeParse({
      embeddingId: "e-1",
      provider: "openai",
      version: "1",
      model: "text-embedding-3",
      status: "ready",
    });
    expect(result.success).toBe(true);
  });

  it("knowledgeEmbeddingReferenceSchema rejects an unknown status", () => {
    const result = knowledgeEmbeddingReferenceSchema.safeParse({
      embeddingId: "e-1",
      provider: "openai",
      version: "1",
      model: "text-embedding-3",
      status: "bogus",
    });
    expect(result.success).toBe(false);
  });

  it("createKnowledgeIndexVersion()/bumpKnowledgeIndexVersion()/formatKnowledgeIndexVersion() work together", () => {
    const version = createKnowledgeIndexVersion();
    expect(knowledgeIndexVersionSchema.safeParse(version).success).toBe(true);
    expect(formatKnowledgeIndexVersion(version)).toBe("1.0.0");
    const bumped = bumpKnowledgeIndexVersion(version);
    expect(formatKnowledgeIndexVersion(bumped)).toBe("1.0.1");
  });

  it("knowledgeIndexEntrySchema accepts a minimal valid Entry", () => {
    const now = new Date().toISOString();
    const result = knowledgeIndexEntrySchema.safeParse({
      id: "i-1",
      indexType: KnowledgeIndexType.KEYWORD,
      assetId: "a-1",
      namespace: "knowledge://tenant-1/ws-1/lib-1/doc-1",
      tenantId: "tenant-1",
      key: "doc-1",
      value: {},
      version: createKnowledgeIndexVersion(),
      chunkRefs: [],
      createdAt: now,
      updatedAt: now,
    });
    expect(result.success).toBe(true);
  });

  it("knowledgeIndexStatisticsSnapshotSchema accepts EMPTY_KNOWLEDGE_INDEX_STATISTICS", () => {
    expect(
      knowledgeIndexStatisticsSnapshotSchema.safeParse(EMPTY_KNOWLEDGE_INDEX_STATISTICS).success,
    ).toBe(true);
  });
});
