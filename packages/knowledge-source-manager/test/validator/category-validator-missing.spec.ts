import { describe, expect, it } from "vitest";

import type { KnowledgeSourceCategory } from "../../src/domain/knowledge-source-category.js";
import { CategoryValidator } from "../../src/validator/category-validator.js";
import { configurationFixture } from "../helpers/configuration-fixture.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { metadataFixture } from "../helpers/metadata-fixture.js";

describe("CategoryValidator missing category", () => {
  it("flags a metadata record with no sourceCategory at all", () => {
    const metadata = metadataFixture();
    // Simulate a caller that bypassed strong typing (e.g. deserialized JSON).
    const broken = { ...metadata, sourceCategory: undefined as unknown as KnowledgeSourceCategory };
    const result = new CategoryValidator().validate({
      metadata: broken,
      context: contextFixture(),
      configuration: configurationFixture(),
    });
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.path).toBe("metadata.sourceCategory");
  });
});
