import { describe, expect, it } from "vitest";

import { VersionValidator } from "../../src/validator/version-validator.js";
import { workflowFixture } from "../helpers/workflow-fixture.js";

describe("Version Validation Test — VersionValidator", () => {
  it("passes a valid SemVer version", () => {
    expect(new VersionValidator().validate(workflowFixture({ version: "1.2.3" })).valid).toBe(true);
  });

  it("fails an invalid SemVer string", () => {
    const result = new VersionValidator().validate(workflowFixture({ version: "not-semver" }));
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.message).toContain("not a valid SemVer");
  });

  it("fails version 0.0.0", () => {
    const result = new VersionValidator().validate(workflowFixture({ version: "0.0.0" }));
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.message).toContain("0.0.0");
  });
});
