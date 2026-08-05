import { describe, expect, it } from "vitest";

import { KnowledgeRuntimeFactory } from "../../src/factory/knowledge-runtime-factory.js";
import type {
  IKnowledgeRuntimeValidatorStage,
  KnowledgeRuntimeValidationInput,
  KnowledgeRuntimeValidationResult,
} from "../../src/validator/i-knowledge-runtime-validator.js";
import { KnowledgeRuntimeValidator } from "../../src/validator/knowledge-runtime-validator.js";

const factory = new KnowledgeRuntimeFactory();

class AlwaysFailsStage implements IKnowledgeRuntimeValidatorStage {
  readonly name = "always-fails";
  validate(_input: KnowledgeRuntimeValidationInput): KnowledgeRuntimeValidationResult {
    return { valid: false, issues: [{ path: "custom", message: "always fails" }] };
  }
}

describe("Validator Test — KnowledgeRuntimeValidator", () => {
  it("valid() for a well-formed Execution across all 11 stages", () => {
    const execution = factory.createExecution({ knowledgeId: "k-1", tenantId: "tenant-1" });
    const result = new KnowledgeRuntimeValidator().validate({ execution });
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("aggregates issues from multiple failing stages without short-circuiting", () => {
    const execution = factory.createExecution({ knowledgeId: "k-1", tenantId: "tenant-1" });
    const invalid = {
      ...execution,
      instance: { ...execution.instance, knowledgeId: "  ", token: "bad-token" },
    };
    const result = new KnowledgeRuntimeValidator().validate({ execution: invalid });
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThanOrEqual(2);
  });

  it("accepts extraStages appended after the built-in 11", () => {
    const execution = factory.createExecution({ knowledgeId: "k-1", tenantId: "tenant-1" });
    const validator = new KnowledgeRuntimeValidator([new AlwaysFailsStage()]);
    const result = validator.validate({ execution });
    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual({ path: "custom", message: "always fails" });
  });
});
