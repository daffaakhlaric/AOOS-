import { describe, expect, it } from "vitest";

import { CapabilityRegistry } from "../../src/capabilities/capability-registry.js";

describe("CapabilityRegistry", () => {
  it("registers and retrieves a capability by name", () => {
    const registry = new CapabilityRegistry();
    registry.register({ name: "lead-scoring", version: "1.0.0" });

    expect(registry.has("lead-scoring")).toBe(true);
    expect(registry.get("lead-scoring")).toEqual({ name: "lead-scoring", version: "1.0.0" });
  });

  it("has() and get() reflect absence correctly", () => {
    const registry = new CapabilityRegistry();
    expect(registry.has("missing")).toBe(false);
    expect(registry.get("missing")).toBeUndefined();
  });

  it("list() returns every registered capability", () => {
    const registry = new CapabilityRegistry();
    registry.register({ name: "a", version: "1.0.0" });
    registry.register({ name: "b", version: "2.0.0" });
    expect(registry.list()).toHaveLength(2);
  });

  it("re-registering the same name overwrites the previous descriptor", () => {
    const registry = new CapabilityRegistry();
    registry.register({ name: "a", version: "1.0.0" });
    registry.register({ name: "a", version: "2.0.0" });
    expect(registry.get("a")?.version).toBe("2.0.0");
    expect(registry.count).toBe(1);
  });

  it("unregister() removes a capability and reports whether it existed", () => {
    const registry = new CapabilityRegistry();
    registry.register({ name: "a", version: "1.0.0" });
    expect(registry.unregister("a")).toBe(true);
    expect(registry.unregister("a")).toBe(false);
    expect(registry.has("a")).toBe(false);
  });

  it("count reflects the number of registered capabilities", () => {
    const registry = new CapabilityRegistry();
    expect(registry.count).toBe(0);
    registry.register({ name: "a", version: "1.0.0" });
    expect(registry.count).toBe(1);
  });
});
