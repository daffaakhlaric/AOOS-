import { describe, expect, it } from "vitest";

import {
  KNOWLEDGE_CLASSIFICATION_RANK,
  KnowledgeClassification,
} from "../../src/domain/knowledge-classification.js";
import { KnowledgeValidationException } from "../../src/errors/knowledge-validation-exception.js";
import { MetadataFactory } from "../../src/factory/metadata-factory.js";
import { KnowledgeMetadataEngine } from "../../src/metadata/knowledge-metadata-engine.js";

describe("Metadata Test — KnowledgeMetadataEngine", () => {
  it("normalize() de-duplicates tags/keywords", () => {
    const metadata = new MetadataFactory().create({
      classification: KnowledgeClassification.INTERNAL,
      tags: ["a", "a", "b"],
      keywords: ["x", "x"],
    });
    const normalized = new KnowledgeMetadataEngine().normalize(metadata);
    expect(normalized.tags).toEqual(["a", "b"]);
    expect(normalized.keywords).toEqual(["x"]);
  });

  it("assertValidConfidence() does not throw for undefined or an in-range value", () => {
    const engine = new KnowledgeMetadataEngine();
    expect(() => engine.assertValidConfidence(undefined)).not.toThrow();
    expect(() => engine.assertValidConfidence(0.5)).not.toThrow();
  });

  it("assertValidConfidence() throws KnowledgeValidationException for an out-of-range value", () => {
    const engine = new KnowledgeMetadataEngine();
    expect(() => engine.assertValidConfidence(1.5)).toThrow(KnowledgeValidationException);
    expect(() => engine.assertValidConfidence(-0.1)).toThrow(KnowledgeValidationException);
  });

  it("canReclassify() allows an upgrade (more sensitive) by default", () => {
    const engine = new KnowledgeMetadataEngine();
    expect(
      engine.canReclassify(
        KnowledgeClassification.PUBLIC,
        KnowledgeClassification.SECRET,
        false,
        KNOWLEDGE_CLASSIFICATION_RANK,
      ),
    ).toBe(true);
  });

  it("canReclassify() disallows a downgrade unless allowDowngrade is true", () => {
    const engine = new KnowledgeMetadataEngine();
    expect(
      engine.canReclassify(
        KnowledgeClassification.SECRET,
        KnowledgeClassification.PUBLIC,
        false,
        KNOWLEDGE_CLASSIFICATION_RANK,
      ),
    ).toBe(false);
    expect(
      engine.canReclassify(
        KnowledgeClassification.SECRET,
        KnowledgeClassification.PUBLIC,
        true,
        KNOWLEDGE_CLASSIFICATION_RANK,
      ),
    ).toBe(true);
  });
});
