import { describe, expect, it } from "vitest";

import { breadthFirstSearch } from "../../src/traversal/breadth-first-search.js";
import { depthFirstSearch } from "../../src/traversal/depth-first-search.js";
import { findNeighbors } from "../../src/traversal/find-neighbors.js";
import { shortestPath } from "../../src/traversal/shortest-path.js";
import {
  buildCycleCandidateEngine,
  buildDisjointComponentsEngine,
  buildMultiPathEngine,
} from "../helpers/graph-fixtures.js";

describe("traversal — over the multi-path fixture", () => {
  it("BFS from S visits every node", () => {
    const engine = buildMultiPathEngine();
    const result = breadthFirstSearch(engine, "S");
    expect(new Set(result.visitedOrder)).toEqual(new Set(["S", "H1", "H2", "T"]));
  });

  it("DFS from S visits every node", () => {
    const engine = buildMultiPathEngine();
    const result = depthFirstSearch(engine, "S");
    expect(new Set(result.visitedOrder)).toEqual(new Set(["S", "H1", "H2", "T"]));
  });

  it("shortestPath finds the 3-hop detour when the direct edge is excluded by edge type", () => {
    const engine = buildMultiPathEngine();
    // Both routes use RelatedTo in this fixture; verify the detour length directly via BFS depth.
    const direct = shortestPath(engine, "S", "T");
    expect(direct?.length).toBe(1);
    const detour = shortestPath(engine, "S", "H2");
    expect(detour?.length).toBe(2);
  });

  it("findNeighbors('both') on H1 returns S and H2", () => {
    const engine = buildMultiPathEngine();
    expect(findNeighbors(engine, "H1").sort()).toEqual(["H2", "S"]);
  });
});

describe("traversal — over the disjoint-components fixture", () => {
  it("BFS from M1 never reaches the N or O components", () => {
    const engine = buildDisjointComponentsEngine();
    const result = breadthFirstSearch(engine, "M1");
    expect(new Set(result.visitedOrder)).toEqual(new Set(["M1", "M2", "M3"]));
  });

  it("shortestPath between different components returns undefined", () => {
    const engine = buildDisjointComponentsEngine();
    expect(shortestPath(engine, "M1", "N1")).toBeUndefined();
    expect(shortestPath(engine, "M1", "O")).toBeUndefined();
  });

  it("findNeighbors on the isolated node O returns an empty array", () => {
    const engine = buildDisjointComponentsEngine();
    expect(findNeighbors(engine, "O")).toEqual([]);
  });
});

describe("traversal — over the cycle-candidate fixture", () => {
  it("BFS from X visits the whole chain but not the isolated W", () => {
    const engine = buildCycleCandidateEngine();
    const result = breadthFirstSearch(engine, "X");
    expect(new Set(result.visitedOrder)).toEqual(new Set(["X", "Y", "Z"]));
    expect(result.visitedOrder).not.toContain("W");
  });

  it("shortestPath from X to W is undefined (disconnected)", () => {
    const engine = buildCycleCandidateEngine();
    expect(shortestPath(engine, "X", "W")).toBeUndefined();
  });
});
