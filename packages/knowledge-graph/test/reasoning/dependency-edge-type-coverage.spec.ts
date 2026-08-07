import { describe, expect, it } from "vitest";

import { DEPENDENCY_EDGE_TYPES } from "../../src/edges/edge-type-semantics.js";
import { GraphEngine } from "../../src/graph/graph-engine.js";
import { findDependencies, findDependents } from "../../src/reasoning/dependency-reasoner.js";
import { addEdge, addNode } from "../helpers/graph-fixtures.js";

describe("findDependencies/findDependents — every dependency edge type", () => {
  it.each(Array.from(DEPENDENCY_EDGE_TYPES))(
    "walks a %s edge for both dependency directions",
    (edgeType) => {
      const engine = GraphEngine.create({ name: "g" });
      addNode(engine, "A");
      addNode(engine, "B");
      addEdge(engine, "A", "B", edgeType);

      expect(findDependencies(engine, "A")).toEqual(["B"]);
      expect(findDependents(engine, "B")).toEqual(["A"]);
    },
  );
});
