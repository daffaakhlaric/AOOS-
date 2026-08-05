import { describe, expect, it } from "vitest";

import { KnowledgeIndexType } from "../../src/domain/knowledge-index-type.js";
import { KnowledgeIndexRegistry } from "../../src/registry/knowledge-index-registry.js";
import type {
  IKnowledgeIndexValidatorStage,
  KnowledgeIndexValidationInput,
  KnowledgeIndexValidationResult,
} from "../../src/validator/i-knowledge-index-validator.js";
import { KnowledgeIndexValidator } from "../../src/validator/knowledge-index-validator.js";
import { assetFixture } from "../helpers/asset-fixture.js";
import { contextFixture } from "../helpers/context-fixture.js";

class AlwaysFailsStage implements IKnowledgeIndexValidatorStage {
  readonly name = "always-fails";
  validate(_input: KnowledgeIndexValidationInput): KnowledgeIndexValidationResult {
    return { valid: false, issues: [{ path: "custom", message: "always fails" }] };
  }
}

describe("Validator Test — KnowledgeIndexValidator", () => {
  it("valid() for a well-formed Asset across all 8 stages", () => {
    const asset = assetFixture();
    const result = new KnowledgeIndexValidator().validate({
      asset,
      context: contextFixture(asset),
      registry: new KnowledgeIndexRegistry(),
      indexTypes: [KnowledgeIndexType.KEYWORD],
    });
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("aggregates issues from multiple failing stages without short-circuiting", () => {
    const asset = { ...assetFixture({ tags: ["a", "a"] }), namespace: "not-a-namespace" };
    const result = new KnowledgeIndexValidator().validate({
      asset,
      context: contextFixture(asset),
      registry: new KnowledgeIndexRegistry(),
      indexTypes: [KnowledgeIndexType.KEYWORD],
    });
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThanOrEqual(2);
  });

  it("accepts extraStages appended after the built-in 8", () => {
    const asset = assetFixture();
    const validator = new KnowledgeIndexValidator([new AlwaysFailsStage()]);
    const result = validator.validate({
      asset,
      context: contextFixture(asset),
      registry: new KnowledgeIndexRegistry(),
      indexTypes: [KnowledgeIndexType.KEYWORD],
    });
    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual({ path: "custom", message: "always fails" });
  });
});
