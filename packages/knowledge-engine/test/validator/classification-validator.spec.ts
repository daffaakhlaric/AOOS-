import { describe, expect, it } from "vitest";

import { KnowledgeClassification } from "../../src/domain/knowledge-classification.js";
import { ClassificationValidator } from "../../src/validator/classification-validator.js";
import { assetFixture } from "../helpers/asset-fixture.js";

describe("Validator Test — ClassificationValidator", () => {
  it("passes when classification matches metadata.classification", () => {
    expect(new ClassificationValidator().validate({ asset: assetFixture() }).valid).toBe(true);
  });

  it("flags a mismatch between classification and metadata.classification", () => {
    const asset = assetFixture({ classification: KnowledgeClassification.PUBLIC });
    const mutated = {
      ...asset,
      metadata: { ...asset.metadata, classification: KnowledgeClassification.SECRET },
    };
    const result = new ClassificationValidator().validate({ asset: mutated });
    expect(result.valid).toBe(false);
  });
});
