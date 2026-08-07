import { describe, expect, it } from "vitest";

import { DuplicateEntryException } from "../../src/errors/duplicate-entry-exception.js";
import { GraphNotFoundException } from "../../src/errors/graph-not-found-exception.js";
import { GraphEngine } from "../../src/graph/graph-engine.js";
import { GraphRegistry } from "../../src/registry/graph-registry.js";

describe("GraphRegistry", () => {
  it("registers and retrieves a GraphEngine by its graph id", () => {
    const registry = new GraphRegistry();
    const engine = GraphEngine.create({ id: "g1", name: "G" });
    registry.register(engine);
    expect(registry.get("g1")).toBe(engine);
    expect(registry.tryGet("g1")).toBe(engine);
    expect(registry.has("g1")).toBe(true);
    expect(registry.list()).toEqual([engine]);
    expect(registry.size).toBe(1);
  });

  it("throws GraphNotFoundException for a missing graph id", () => {
    const registry = new GraphRegistry();
    expect(() => registry.get("missing")).toThrow(GraphNotFoundException);
  });

  it("tryGet returns undefined for a missing graph id", () => {
    const registry = new GraphRegistry();
    expect(registry.tryGet("missing")).toBeUndefined();
  });

  it("throws DuplicateEntryException on id collision", () => {
    const registry = new GraphRegistry();
    registry.register(GraphEngine.create({ id: "g1", name: "G" }));
    expect(() => registry.register(GraphEngine.create({ id: "g1", name: "G2" }))).toThrow(
      DuplicateEntryException,
    );
  });

  it("remove/clear work as expected", () => {
    const registry = new GraphRegistry();
    registry.register(GraphEngine.create({ id: "g1", name: "G" }));
    expect(registry.remove("g1")).toBe(true);
    expect(registry.has("g1")).toBe(false);
    registry.register(GraphEngine.create({ id: "g2", name: "G2" }));
    registry.clear();
    expect(registry.size).toBe(0);
  });
});
