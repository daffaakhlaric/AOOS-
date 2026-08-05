import { describe, expect, it } from "vitest";

import { VersionValidator } from "../../src/validator/version-validator.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("Node Validation Test — VersionValidator", () => {
  it("passes a valid SemVer Manifest version", () => {
    expect(new VersionValidator().validate(executionFixture()).valid).toBe(true);
  });

  it("fails an invalid SemVer Manifest version", () => {
    const execution = executionFixture();
    const badVersion = { ...execution, manifest: { ...execution.manifest, version: "not-semver" } };
    const result = new VersionValidator().validate(badVersion);
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.message).toContain("not a valid SemVer");
  });
});
