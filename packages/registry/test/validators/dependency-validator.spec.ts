import { describe, expect, it } from "vitest";

import { DependencyValidator } from "../../src/validators/dependency-validator.js";

describe("DependencyValidator", () => {
  it("passes when every dependency id is known", () => {
    const validator = new DependencyValidator();
    const context = { existingIds: new Set(["a", "b"]), existingVersionsById: new Map() };
    const result = validator.validate(
      { id: "c", version: "1.0.0", category: "x", dependencies: ["a", "b"] },
      context,
    );
    expect(result.valid).toBe(true);
  });

  it("passes when the manifest declares no dependencies", () => {
    const validator = new DependencyValidator();
    const context = { existingIds: new Set<string>(), existingVersionsById: new Map() };
    expect(validator.validate({ id: "a", version: "1.0.0", category: "x" }, context).valid).toBe(
      true,
    );
  });

  it("flags every unknown dependency id as an issue", () => {
    const validator = new DependencyValidator();
    const context = { existingIds: new Set(["a"]), existingVersionsById: new Map() };
    const result = validator.validate(
      { id: "c", version: "1.0.0", category: "x", dependencies: ["a", "ghost"] },
      context,
    );
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.message).toContain("ghost");
  });
});
