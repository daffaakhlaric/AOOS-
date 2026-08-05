import { describe, expect, it } from "vitest";

import {
  hasRequiredCapabilities,
  isVersionCompatible,
  missingCapabilities,
} from "../../src/dependency/version-compatibility.js";

describe("Version Compatibility check", () => {
  it("returns true when the version satisfies the range", () => {
    expect(isVersionCompatible("1.2.3", "^1.0.0")).toBe(true);
  });

  it("returns false when the version does not satisfy the range", () => {
    expect(isVersionCompatible("2.0.0", "^1.0.0")).toBe(false);
  });

  it("returns false (not throws) for an invalid version or range", () => {
    expect(isVersionCompatible("bad", "^1.0.0")).toBe(false);
    expect(isVersionCompatible("1.0.0", "bad")).toBe(false);
  });
});

describe("Capability Check", () => {
  it("hasRequiredCapabilities is true when every required capability is provided", () => {
    expect(hasRequiredCapabilities(["a", "b", "c"], ["a", "c"])).toBe(true);
  });

  it("hasRequiredCapabilities is false when any required capability is missing", () => {
    expect(hasRequiredCapabilities(["a"], ["a", "b"])).toBe(false);
  });

  it("missingCapabilities lists exactly the unmet requirements", () => {
    expect(missingCapabilities(["a"], ["a", "b", "c"])).toEqual(["b", "c"]);
  });

  it("missingCapabilities is empty when everything is satisfied", () => {
    expect(missingCapabilities(["a", "b"], ["a"])).toEqual([]);
  });
});
