import { describe, expect, it } from "vitest";

import { KnowledgeClassification } from "../../src/domain/knowledge-classification.js";
import { MetadataFactory } from "../../src/factory/metadata-factory.js";

describe("Factory Test — MetadataFactory", () => {
  it("creates Metadata with matching createdAt/updatedAt", () => {
    const metadata = new MetadataFactory().create({
      classification: KnowledgeClassification.INTERNAL,
    });
    expect(metadata.createdAt).toBe(metadata.updatedAt);
    expect(metadata.classification).toBe(KnowledgeClassification.INTERNAL);
    expect(metadata.tags).toEqual([]);
    expect(metadata.keywords).toEqual([]);
    expect(metadata.custom).toEqual({});
  });

  it("carries through optional fields", () => {
    const metadata = new MetadataFactory().create({
      classification: KnowledgeClassification.PUBLIC,
      author: "Alice",
      tags: ["a", "b"],
      confidence: 0.9,
      custom: { source: "manual" },
    });
    expect(metadata.author).toBe("Alice");
    expect(metadata.tags).toEqual(["a", "b"]);
    expect(metadata.confidence).toBe(0.9);
    expect(metadata.custom).toEqual({ source: "manual" });
  });
});
