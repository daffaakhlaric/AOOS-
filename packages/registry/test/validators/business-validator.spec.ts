import { describe, expect, it } from "vitest";

import { BusinessValidator, type BusinessRule } from "../../src/validators/business-validator.js";

interface TestManifest {
  readonly category: string;
}

const context = { existingIds: new Set<string>(), existingVersionsById: new Map() };

describe("BusinessValidator", () => {
  it("passes when no rules are configured (default no-op)", () => {
    const validator = new BusinessValidator<TestManifest>();
    expect(validator.validate({ category: "anything" }, context).valid).toBe(true);
  });

  it("runs every configured rule and aggregates issues", () => {
    const ruleA: BusinessRule<TestManifest> = (manifest) =>
      manifest.category === "invalid" ? [{ path: "category", message: "not allowed" }] : [];
    const ruleB: BusinessRule<TestManifest> = () => [{ path: "other", message: "always fails" }];

    const validator = new BusinessValidator<TestManifest>([ruleA, ruleB]);
    const result = validator.validate({ category: "invalid" }, context);

    expect(result.valid).toBe(false);
    expect(result.issues).toHaveLength(2);
  });

  it("passes when all rules return no issues", () => {
    const rule: BusinessRule<TestManifest> = () => [];
    const validator = new BusinessValidator<TestManifest>([rule]);
    expect(validator.validate({ category: "ok" }, context).valid).toBe(true);
  });
});
