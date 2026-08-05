import { describe, expect, it } from "vitest";

import type { IValidator, ValidationResult } from "../../src/interfaces/i-validator.js";
import { ValidationPipeline } from "../../src/validators/validation-pipeline.js";

function fakeValidator(name: string, result: ValidationResult): IValidator<unknown> {
  return { name, validate: () => result };
}

const context = { existingIds: new Set<string>(), existingVersionsById: new Map() };

describe("ValidationPipeline", () => {
  it("passes when every stage passes", async () => {
    const pipeline = new ValidationPipeline([
      fakeValidator("a", { valid: true, issues: [] }),
      fakeValidator("b", { valid: true, issues: [] }),
    ]);
    const result = await pipeline.run({}, context);
    expect(result.valid).toBe(true);
  });

  it("aggregates issues from every stage, not just the first failure", async () => {
    const pipeline = new ValidationPipeline([
      fakeValidator("a", { valid: false, issues: [{ path: "a", message: "fail a" }] }),
      fakeValidator("b", { valid: false, issues: [{ path: "b", message: "fail b" }] }),
    ]);
    const result = await pipeline.run({}, context);
    expect(result.valid).toBe(false);
    expect(result.issues).toHaveLength(2);
  });

  it("supports async validators", async () => {
    const asyncValidator: IValidator<unknown> = {
      name: "async",
      validate: async () => ({ valid: true, issues: [] }),
    };
    const pipeline = new ValidationPipeline([asyncValidator]);
    expect((await pipeline.run({}, context)).valid).toBe(true);
  });
});
