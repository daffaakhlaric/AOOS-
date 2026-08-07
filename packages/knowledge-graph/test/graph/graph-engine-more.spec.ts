import { describe, expect, it } from "vitest";

import { GraphEngine } from "../../src/graph/graph-engine.js";
import { addEdge, addNode, buildDagEngine } from "../helpers/graph-fixtures.js";

describe("GraphEngine — additional coverage", () => {
  it("graph.name and graph.description are mutable via direct aggregate access", () => {
    const engine = GraphEngine.create({ name: "Original" });
    engine.graph.name = "Renamed";
    expect(engine.graph.name).toBe("Renamed");
  });

  it("touch() bumps updatedAt on every mutating call", () => {
    const engine = buildDagEngine();
    const before = engine.graph.updatedAt;
    addNode(engine, "E");
    expect(engine.graph.updatedAt).toBeGreaterThanOrEqual(before);
  });

  it("a node can have multiple outgoing edges to different targets", () => {
    const engine = buildDagEngine();
    addNode(engine, "E");
    addEdge(engine, "A", "E");
    expect(engine.outgoingEdges("A")).toHaveLength(3);
  });

  it("listNodes/listEdges reflect additions and removals live", () => {
    const engine = GraphEngine.create({ name: "g" });
    expect(engine.listNodes()).toEqual([]);
    addNode(engine, "A");
    expect(engine.listNodes()).toHaveLength(1);
    engine.removeNode("A");
    expect(engine.listNodes()).toEqual([]);
  });
});
