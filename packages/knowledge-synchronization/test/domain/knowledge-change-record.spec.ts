import { describe, expect, it } from "vitest";

import { knowledgeChangeRecordSchema } from "../../src/domain/knowledge-change-record.js";
import { KnowledgeChangeType } from "../../src/domain/knowledge-change-type.js";

describe("knowledgeChangeRecordSchema", () => {
  const base = {
    id: "change-1",
    changeType: KnowledgeChangeType.ADDED,
    detectedAt: "2026-01-01T00:00:00.000Z",
    metadata: {},
  };

  it("accepts the minimal required shape", () => {
    expect(knowledgeChangeRecordSchema.parse(base)).toMatchObject(base);
  });

  it("accepts optional assetId/path/previousPath/contentHash", () => {
    const parsed = knowledgeChangeRecordSchema.parse({
      ...base,
      assetId: "asset-1",
      path: "/a/b",
      previousPath: "/a/c",
      contentHash: "abc123",
    });
    expect(parsed.assetId).toBe("asset-1");
  });

  it("rejects an unknown changeType", () => {
    expect(() => knowledgeChangeRecordSchema.parse({ ...base, changeType: "bogus" })).toThrow();
  });
});
