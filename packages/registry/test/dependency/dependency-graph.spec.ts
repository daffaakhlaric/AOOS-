import { describe, expect, it } from "vitest";

import { DependencyGraph } from "../../src/dependency/dependency-graph.js";

describe("Dependency Resolution Test — DependencyGraph", () => {
  it("returns ok=true with a topological load order for an acyclic graph", () => {
    const graph = new DependencyGraph();
    const result = graph.check(
      new Map([
        ["c", ["a", "b"]],
        ["b", ["a"]],
        ["a", []],
      ]),
    );

    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.circular).toEqual([]);
    expect(result.loadOrder.indexOf("a")).toBeLessThan(result.loadOrder.indexOf("b"));
    expect(result.loadOrder.indexOf("b")).toBeLessThan(result.loadOrder.indexOf("c"));
  });

  it("Missing Dependency Detection: flags a dependency id not present in the graph", () => {
    const graph = new DependencyGraph();
    const result = graph.check(new Map([["a", ["ghost"]]]));
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(["ghost"]);
  });

  it("returns an empty load order when there are missing dependencies", () => {
    const graph = new DependencyGraph();
    const result = graph.check(new Map([["a", ["ghost"]]]));
    expect(result.loadOrder).toEqual([]);
  });
});

describe("Circular Dependency Test — DependencyGraph", () => {
  it("detects a direct two-node cycle (A → B → A)", () => {
    const graph = new DependencyGraph();
    const result = graph.check(
      new Map([
        ["a", ["b"]],
        ["b", ["a"]],
      ]),
    );
    expect(result.ok).toBe(false);
    expect(result.circular.length).toBeGreaterThan(0);
  });

  it("detects a self-referencing cycle (A → A)", () => {
    const graph = new DependencyGraph();
    const result = graph.check(new Map([["a", ["a"]]]));
    expect(result.ok).toBe(false);
    expect(result.circular[0]).toEqual(["a", "a"]);
  });

  it("detects a longer cycle (A → B → C → A)", () => {
    const graph = new DependencyGraph();
    const result = graph.check(
      new Map([
        ["a", ["b"]],
        ["b", ["c"]],
        ["c", ["a"]],
      ]),
    );
    expect(result.ok).toBe(false);
    expect(result.circular.length).toBeGreaterThan(0);
  });

  it("does not flag a diamond dependency shape (A→B, A→C, B→D, C→D) as circular", () => {
    const graph = new DependencyGraph();
    const result = graph.check(
      new Map([
        ["a", ["b", "c"]],
        ["b", ["d"]],
        ["c", ["d"]],
        ["d", []],
      ]),
    );
    expect(result.ok).toBe(true);
  });

  it("an empty graph is trivially valid", () => {
    const graph = new DependencyGraph();
    const result = graph.check(new Map());
    expect(result.ok).toBe(true);
    expect(result.loadOrder).toEqual([]);
  });
});
