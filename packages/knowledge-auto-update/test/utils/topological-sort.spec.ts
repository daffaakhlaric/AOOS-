import { describe, expect, it } from "vitest";

import { DependencyCycleException } from "../../src/errors/dependency-cycle-exception.js";
import {
  priorityTopologicalSort,
  topologicalSort,
  type DependencyEdge,
} from "../../src/utils/topological-sort.js";

describe("topologicalSort", () => {
  it("returns nodes as-is when there are no edges", () => {
    expect(topologicalSort(["a", "b", "c"], [])).toEqual(["a", "b", "c"]);
  });

  it("orders a simple chain a -> b -> c", () => {
    const edges: DependencyEdge[] = [
      { from: "a", to: "b" },
      { from: "b", to: "c" },
    ];
    expect(topologicalSort(["c", "b", "a"], edges)).toEqual(["a", "b", "c"]);
  });

  it("orders a diamond dependency graph", () => {
    const edges: DependencyEdge[] = [
      { from: "a", to: "b" },
      { from: "a", to: "c" },
      { from: "b", to: "d" },
      { from: "c", to: "d" },
    ];
    const order = topologicalSort(["a", "b", "c", "d"], edges);
    expect(order.indexOf("a")).toBeLessThan(order.indexOf("b"));
    expect(order.indexOf("a")).toBeLessThan(order.indexOf("c"));
    expect(order.indexOf("b")).toBeLessThan(order.indexOf("d"));
    expect(order.indexOf("c")).toBeLessThan(order.indexOf("d"));
  });

  it("breaks ties by original array order", () => {
    const edges: DependencyEdge[] = [];
    expect(topologicalSort(["z", "y", "x"], edges)).toEqual(["z", "y", "x"]);
  });

  it("throws DependencyCycleException on a direct 2-node cycle", () => {
    const edges: DependencyEdge[] = [
      { from: "a", to: "b" },
      { from: "b", to: "a" },
    ];
    expect(() => topologicalSort(["a", "b"], edges)).toThrow(DependencyCycleException);
  });

  it("throws DependencyCycleException on a longer cycle", () => {
    const edges: DependencyEdge[] = [
      { from: "a", to: "b" },
      { from: "b", to: "c" },
      { from: "c", to: "a" },
    ];
    expect(() => topologicalSort(["a", "b", "c"], edges)).toThrow(DependencyCycleException);
  });

  it("throws DependencyCycleException when an edge references an unknown node", () => {
    const edges: DependencyEdge[] = [{ from: "a", to: "missing" }];
    expect(() => topologicalSort(["a"], edges)).toThrow(DependencyCycleException);
  });

  it("handles a single node with no edges", () => {
    expect(topologicalSort(["solo"], [])).toEqual(["solo"]);
  });

  it("handles an empty node list", () => {
    expect(topologicalSort([], [])).toEqual([]);
  });

  it("orders a wide fan-out graph (1 root, 5 independent children)", () => {
    const edges: DependencyEdge[] = ["a", "b", "c", "d", "e"].map((child) => ({
      from: "root",
      to: child,
    }));
    const order = topologicalSort(["a", "b", "c", "d", "e", "root"], edges);
    expect(order[0]).toBe("root");
    expect(order.slice(1).sort()).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("orders a wide fan-in graph (5 independent parents, 1 sink)", () => {
    const edges: DependencyEdge[] = ["a", "b", "c", "d", "e"].map((parent) => ({
      from: parent,
      to: "sink",
    }));
    const order = topologicalSort(["sink", "a", "b", "c", "d", "e"], edges);
    expect(order[order.length - 1]).toBe("sink");
  });

  it("orders a 15-node linear chain correctly", () => {
    const ids = Array.from({ length: 15 }, (_, i) => `n${i}`);
    const edges: DependencyEdge[] = ids.slice(1).map((id, i) => ({ from: ids[i]!, to: id }));
    expect(topologicalSort([...ids].reverse(), edges)).toEqual(ids);
  });
});

describe("priorityTopologicalSort", () => {
  it("orders independent nodes purely by priority (highest first)", () => {
    const priorities: Record<string, number> = { a: 1, b: 5, c: 3 };
    const order = priorityTopologicalSort(["a", "b", "c"], [], (n) => priorities[n]!);
    expect(order).toEqual(["b", "c", "a"]);
  });

  it("breaks priority ties by original array order (FIFO)", () => {
    const order = priorityTopologicalSort(["a", "b", "c"], [], () => 1);
    expect(order).toEqual(["a", "b", "c"]);
  });

  it("still respects dependency order even when priority would suggest otherwise", () => {
    // b depends on a, but b has higher priority — a must still come first.
    const priorities: Record<string, number> = { a: 1, b: 10 };
    const edges: DependencyEdge[] = [{ from: "a", to: "b" }];
    const order = priorityTopologicalSort(["a", "b"], edges, (n) => priorities[n]!);
    expect(order).toEqual(["a", "b"]);
  });

  it("picks the highest-priority ready node at each step", () => {
    // a and b are both roots; c depends on a; d depends on b.
    const priorities: Record<string, number> = { a: 1, b: 5, c: 10, d: 10 };
    const edges: DependencyEdge[] = [
      { from: "a", to: "c" },
      { from: "b", to: "d" },
    ];
    const order = priorityTopologicalSort(["a", "b", "c", "d"], edges, (n) => priorities[n]!);
    // b (priority 5) should be picked before a (priority 1) among the initial ready set.
    expect(order[0]).toBe("b");
    expect(order.indexOf("a")).toBeLessThan(order.indexOf("c"));
    expect(order.indexOf("b")).toBeLessThan(order.indexOf("d"));
  });

  it("throws DependencyCycleException on a cycle", () => {
    const edges: DependencyEdge[] = [
      { from: "a", to: "b" },
      { from: "b", to: "a" },
    ];
    expect(() => priorityTopologicalSort(["a", "b"], edges, () => 0)).toThrow(
      DependencyCycleException,
    );
  });

  it("throws DependencyCycleException when an edge references an unknown node", () => {
    const edges: DependencyEdge[] = [{ from: "a", to: "missing" }];
    expect(() => priorityTopologicalSort(["a"], edges, () => 0)).toThrow(DependencyCycleException);
  });

  it("handles an empty node list", () => {
    expect(priorityTopologicalSort([], [], () => 0)).toEqual([]);
  });
});
