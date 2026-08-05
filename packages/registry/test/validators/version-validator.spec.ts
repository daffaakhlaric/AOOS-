import { describe, expect, it } from "vitest";

import { VersionValidator } from "../../src/validators/version-validator.js";

describe("Version Test — VersionValidator", () => {
  it("accepts the first version registered for a new id", () => {
    const validator = new VersionValidator();
    const context = { existingIds: new Set<string>(), existingVersionsById: new Map() };
    expect(validator.validate({ id: "a", version: "1.0.0", category: "x" }, context).valid).toBe(
      true,
    );
  });

  it("accepts a version strictly greater than every existing version", () => {
    const validator = new VersionValidator();
    const context = {
      existingIds: new Set(["a"]),
      existingVersionsById: new Map([["a", ["1.0.0", "1.1.0"]]]),
    };
    expect(validator.validate({ id: "a", version: "1.2.0", category: "x" }, context).valid).toBe(
      true,
    );
  });

  it("rejects a duplicate version", () => {
    const validator = new VersionValidator();
    const context = {
      existingIds: new Set(["a"]),
      existingVersionsById: new Map([["a", ["1.0.0"]]]),
    };
    expect(validator.validate({ id: "a", version: "1.0.0", category: "x" }, context).valid).toBe(
      false,
    );
  });

  it("rejects a downgrade", () => {
    const validator = new VersionValidator();
    const context = {
      existingIds: new Set(["a"]),
      existingVersionsById: new Map([["a", ["2.0.0"]]]),
    };
    expect(validator.validate({ id: "a", version: "1.0.0", category: "x" }, context).valid).toBe(
      false,
    );
  });

  it("rejects an invalid SemVer string", () => {
    const validator = new VersionValidator();
    const context = { existingIds: new Set<string>(), existingVersionsById: new Map() };
    const result = validator.validate({ id: "a", version: "not-semver", category: "x" }, context);
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.message).toContain("not a valid SemVer");
  });
});
