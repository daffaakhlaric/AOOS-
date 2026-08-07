import { describe, expect, it } from "vitest";

import { NodeNotFoundException } from "../../src/errors/node-not-found-exception.js";
import { shortestPath } from "../../src/traversal/shortest-path.js";
import { buildDagEngine, buildMultiPathEngine } from "../helpers/graph-fixtures.js";

describe("shortestPath", () => {
  it("returns a length-0 path when start === end", () => {
    const engine = buildDagEngine();
    const path = shortestPath(engine, "A", "A");
    expect(path).toEqual({ nodeIds: ["A"], edgeIds: [], length: 0 });
  });

  it("prefers the shortest (fewest-hop) route when multiple paths exist", () => {
    const engine = buildMultiPathEngine();
    const path = shortestPath(engine, "S", "T");
    expect(path).toBeDefined();
    expect(path?.length).toBe(1);
    expect(path?.nodeIds).toEqual(["S", "T"]);
  });

  it("finds a longer path when no shortcut exists", () => {
    const engine = buildDagEngine();
    const path = shortestPath(engine, "B", "D");
    expect(path).toEqual({
      nodeIds: ["B", "C", "D"],
      edgeIds: ["DependsOn:B->C", "DependsOn:C->D"],
      length: 2,
    });
  });

  it("returns undefined when no path exists", () => {
    const engine = buildDagEngine();
    const path = shortestPath(engine, "D", "A");
    expect(path).toBeUndefined();
  });

  it("throws NodeNotFoundException for a missing start node", () => {
    const engine = buildDagEngine();
    expect(() => shortestPath(engine, "missing", "A")).toThrow(NodeNotFoundException);
  });

  it("throws NodeNotFoundException for a missing end node", () => {
    const engine = buildDagEngine();
    expect(() => shortestPath(engine, "A", "missing")).toThrow(NodeNotFoundException);
  });
});
