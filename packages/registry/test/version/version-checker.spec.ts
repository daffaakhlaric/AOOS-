import { describe, expect, it } from "vitest";

import { VersionException } from "../../src/errors/version-exception.js";
import { VersionChecker } from "../../src/version/version-checker.js";

describe("Version Test — VersionChecker", () => {
  const checker = new VersionChecker();

  it("isCompatible returns true/false correctly", () => {
    expect(checker.isCompatible("1.2.3", "^1.0.0")).toBe(true);
    expect(checker.isCompatible("2.0.0", "^1.0.0")).toBe(false);
  });

  it("isCompatible throws VersionException for an invalid version", () => {
    expect(() => checker.isCompatible("bad", "^1.0.0")).toThrow(VersionException);
  });

  it("isCompatible throws VersionException for an invalid range", () => {
    expect(() => checker.isCompatible("1.0.0", "bad")).toThrow(VersionException);
  });

  it("compare returns -1, 0, 1", () => {
    expect(checker.compare("1.0.0", "2.0.0")).toBe(-1);
    expect(checker.compare("2.0.0", "2.0.0")).toBe(0);
    expect(checker.compare("3.0.0", "2.0.0")).toBe(1);
  });

  it("isBreakingChange is true for a major version bump", () => {
    expect(checker.isBreakingChange("1.5.0", "2.0.0")).toBe(true);
  });

  it("isBreakingChange is false for minor/patch changes", () => {
    expect(checker.isBreakingChange("1.0.0", "1.1.0")).toBe(false);
    expect(checker.isBreakingChange("1.0.0", "1.0.1")).toBe(false);
  });

  it("isBreakingChange throws VersionException for invalid input", () => {
    expect(() => checker.isBreakingChange("bad", "1.0.0")).toThrow(VersionException);
  });
});
