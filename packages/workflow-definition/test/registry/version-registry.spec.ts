import { describe, expect, it } from "vitest";

import { VersionRegistry } from "../../src/registry/version-registry.js";

describe("Registry Test — VersionRegistry", () => {
  it("records and lists versions sorted ascending by SemVer", () => {
    const registry = new VersionRegistry();
    registry.record("wf-1", "1.1.0");
    registry.record("wf-1", "1.0.0");
    registry.record("wf-1", "2.0.0");
    expect(registry.list("wf-1")).toEqual(["1.0.0", "1.1.0", "2.0.0"]);
  });

  it("does not duplicate an already-recorded version", () => {
    const registry = new VersionRegistry();
    registry.record("wf-1", "1.0.0");
    registry.record("wf-1", "1.0.0");
    expect(registry.list("wf-1")).toEqual(["1.0.0"]);
  });

  it("returns the highest version via latest()", () => {
    const registry = new VersionRegistry();
    registry.record("wf-1", "1.0.0");
    registry.record("wf-1", "2.0.0");
    expect(registry.latest("wf-1")).toBe("2.0.0");
  });

  it("returns undefined from latest() and [] from list() for an unknown id", () => {
    const registry = new VersionRegistry();
    expect(registry.latest("ghost")).toBeUndefined();
    expect(registry.list("ghost")).toEqual([]);
  });

  it("removes a version", () => {
    const registry = new VersionRegistry();
    registry.record("wf-1", "1.0.0");
    registry.record("wf-1", "2.0.0");
    registry.remove("wf-1", "1.0.0");
    expect(registry.list("wf-1")).toEqual(["2.0.0"]);
  });

  it("remove() on an unknown id is a no-op", () => {
    const registry = new VersionRegistry();
    expect(() => registry.remove("ghost", "1.0.0")).not.toThrow();
  });
});
