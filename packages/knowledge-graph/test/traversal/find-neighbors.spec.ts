import { describe, expect, it } from "vitest";

import { KnowledgeEdgeType } from "../../src/domain/knowledge-edge-type.js";
import { NodeNotFoundException } from "../../src/errors/node-not-found-exception.js";
import { findNeighbors } from "../../src/traversal/find-neighbors.js";
import { addEdge, buildDagEngine } from "../helpers/graph-fixtures.js";

describe("findNeighbors", () => {
  it("defaults to 'both' directions", () => {
    const engine = buildDagEngine();
    expect(findNeighbors(engine, "C").sort()).toEqual(["A", "B", "D"]);
  });

  it("'outgoing' returns only nodes reachable via outgoing edges", () => {
    const engine = buildDagEngine();
    expect(findNeighbors(engine, "A", "outgoing").sort()).toEqual(["B", "C"]);
  });

  it("'incoming' returns only nodes reachable via incoming edges", () => {
    const engine = buildDagEngine();
    expect(findNeighbors(engine, "C", "incoming").sort()).toEqual(["A", "B"]);
  });

  it("deduplicates a neighbor reachable via multiple edges", () => {
    const engine = buildDagEngine();
    addEdge(engine, "A", "B", KnowledgeEdgeType.RelatedTo);
    expect(findNeighbors(engine, "A", "outgoing").sort()).toEqual(["B", "C"]);
  });

  it("filters by edge type when supplied", () => {
    const engine = buildDagEngine();
    addEdge(engine, "A", "B", KnowledgeEdgeType.RelatedTo);
    expect(findNeighbors(engine, "A", "outgoing", [KnowledgeEdgeType.RelatedTo])).toEqual(["B"]);
  });

  it("throws NodeNotFoundException for a missing node", () => {
    const engine = buildDagEngine();
    expect(() => findNeighbors(engine, "missing")).toThrow(NodeNotFoundException);
  });

  it("returns an empty array for a node with no neighbors in the requested direction", () => {
    const engine = buildDagEngine();
    expect(findNeighbors(engine, "D", "outgoing")).toEqual([]);
  });
});
