import { describe, expect, it } from "vitest";

import { KnowledgeEdgeType } from "../../src/domain/knowledge-edge-type.js";
import { NodeNotFoundException } from "../../src/errors/node-not-found-exception.js";
import { findAncestors, findDescendants } from "../../src/traversal/find-ancestors-descendants.js";
import { buildDagEngine } from "../helpers/graph-fixtures.js";

describe("findDescendants", () => {
  it("returns every transitively reachable node, excluding the start node", () => {
    const engine = buildDagEngine();
    expect(findDescendants(engine, "A").sort()).toEqual(["B", "C", "D"]);
  });

  it("a leaf node has no descendants", () => {
    const engine = buildDagEngine();
    expect(findDescendants(engine, "D")).toEqual([]);
  });

  it("filters by edge type", () => {
    const engine = buildDagEngine();
    expect(findDescendants(engine, "A", [KnowledgeEdgeType.RelatedTo])).toEqual([]);
  });

  it("throws NodeNotFoundException for a missing node", () => {
    const engine = buildDagEngine();
    expect(() => findDescendants(engine, "missing")).toThrow(NodeNotFoundException);
  });
});

describe("findAncestors", () => {
  it("returns every transitive ancestor, excluding the start node", () => {
    const engine = buildDagEngine();
    expect(findAncestors(engine, "D").sort()).toEqual(["A", "B", "C"]);
  });

  it("a root node has no ancestors", () => {
    const engine = buildDagEngine();
    expect(findAncestors(engine, "A")).toEqual([]);
  });

  it("filters by edge type", () => {
    const engine = buildDagEngine();
    expect(findAncestors(engine, "D", [KnowledgeEdgeType.RelatedTo])).toEqual([]);
  });

  it("throws NodeNotFoundException for a missing node", () => {
    const engine = buildDagEngine();
    expect(() => findAncestors(engine, "missing")).toThrow(NodeNotFoundException);
  });
});
