import { describe, expect, it } from "vitest";

import { knowledgeIndexEntrySchema } from "../../src/domain/knowledge-index-entry.js";
import { KnowledgeIndexType } from "../../src/domain/knowledge-index-type.js";
import { createKnowledgeIndexVersion } from "../../src/domain/knowledge-index-version.js";

function baseEntry() {
  const now = new Date().toISOString();
  return {
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
  };
}

describe("Domain Test — knowledgeIndexEntrySchema edge cases", () => {
  it("rejects an unknown indexType", () => {
    const result = knowledgeIndexEntrySchema.safeParse({ ...baseEntry(), indexType: "bogus" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing tenantId", () => {
    const { tenantId: _tenantId, ...rest } = baseEntry();
    expect(knowledgeIndexEntrySchema.safeParse(rest).success).toBe(false);
  });

  it("accepts an optional embeddingRef", () => {
    const result = knowledgeIndexEntrySchema.safeParse({
      ...baseEntry(),
      embeddingRef: {
        embeddingId: "e-1",
        provider: "openai",
        version: "1",
        model: "m",
        status: "ready",
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts a populated chunkRefs array", () => {
    const result = knowledgeIndexEntrySchema.safeParse({
      ...baseEntry(),
      chunkRefs: [
        {
          id: "c-1",
          assetId: "a-1",
          sequence: 0,
          externalRef: "r-1",
          createdAt: new Date().toISOString(),
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a malformed chunkRef entry", () => {
    const result = knowledgeIndexEntrySchema.safeParse({
      ...baseEntry(),
      chunkRefs: [{ id: "c-1" }],
    });
    expect(result.success).toBe(false);
  });
});
