import { describe, expect, it } from "vitest";

import type {
  IKnowledgeSourceValidator,
  KnowledgeSourceValidationInput,
  KnowledgeSourceValidationResult,
} from "../../src/contracts/i-knowledge-source-validator.js";
import { KnowledgeSourceValidator } from "../../src/validator/knowledge-source-validator.js";
import { configurationFixture } from "../helpers/configuration-fixture.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { metadataFixture } from "../helpers/metadata-fixture.js";

function validInput(): KnowledgeSourceValidationInput {
  return {
    metadata: metadataFixture(),
    context: contextFixture(),
    configuration: configurationFixture(),
  };
}

describe("KnowledgeSourceValidator", () => {
  it("passes for a fully well-formed input", () => {
    const validator = new KnowledgeSourceValidator();
    expect(validator.validate(validInput()).valid).toBe(true);
  });

  it("aggregates issues from multiple stages without short-circuiting", () => {
    const validator = new KnowledgeSourceValidator();
    const input = validInput();
    const result = validator.validate({
      ...input,
      metadata: metadataFixture({ sourceId: "", sourceName: "" }),
      context: contextFixture({ sourceId: "", tenantId: "" }),
    });
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(1);
  });

  it("flags a sourceId mismatch between metadata and context", () => {
    const validator = new KnowledgeSourceValidator();
    const input = validInput();
    const result = validator.validate({ ...input, context: contextFixture({ sourceId: "other" }) });
    expect(result.valid).toBe(false);
  });

  it("flags a providerId mismatch between metadata and context", () => {
    const validator = new KnowledgeSourceValidator();
    const input = validInput();
    const result = validator.validate({
      ...input,
      context: contextFixture({ providerId: "other" }),
    });
    expect(result.valid).toBe(false);
  });

  it("flags an invalid configuration (autoSync without enabled)", () => {
    const validator = new KnowledgeSourceValidator();
    const input = validInput();
    const result = validator.validate({
      ...input,
      configuration: configurationFixture({ autoSync: true, enabled: false }),
    });
    expect(result.valid).toBe(false);
  });

  it("flags a blank tenantId", () => {
    const validator = new KnowledgeSourceValidator();
    const input = validInput();
    const result = validator.validate({ ...input, context: contextFixture({ tenantId: "" }) });
    expect(result.valid).toBe(false);
  });

  it("flags a malformed execution token", () => {
    const validator = new KnowledgeSourceValidator();
    const input = validInput();
    const result = validator.validate({
      ...input,
      context: contextFixture({ token: "not-a-token" }),
    });
    expect(result.valid).toBe(false);
  });

  it("runs caller-supplied extra stages", () => {
    const extraStage: IKnowledgeSourceValidator = {
      name: "custom",
      validate: (): KnowledgeSourceValidationResult => ({
        valid: false,
        issues: [{ path: "custom", message: "always fails" }],
      }),
    };
    const validator = new KnowledgeSourceValidator([extraStage]);
    expect(validator.validate(validInput()).valid).toBe(false);
  });
});
