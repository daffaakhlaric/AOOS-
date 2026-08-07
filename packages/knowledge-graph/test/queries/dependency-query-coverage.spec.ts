import { describe, expect, it } from "vitest";

import { DEPENDENCY_EDGE_TYPES } from "../../src/edges/edge-type-semantics.js";
import { GraphEngine } from "../../src/graph/graph-engine.js";
import { executeGraphQuery } from "../../src/queries/graph-query-executor.js";
import { addEdge, addNode } from "../helpers/graph-fixtures.js";

describe("executeGraphQuery — DependencyQuery over every dependency edge type", () => {
  it.each(Array.from(DEPENDENCY_EDGE_TYPES))(
    "resolves dependencies/dependents through a %s edge",
    (edgeType) => {
      const engine = GraphEngine.create({ name: "g" });
      addNode(engine, "A");
      addNode(engine, "B");
      addEdge(engine, "A", "B", edgeType);

      expect(
        executeGraphQuery(engine, {
          kind: "DependencyQuery",
          nodeId: "A",
          direction: "dependencies",
        }),
      ).toEqual(["B"]);
      expect(
        executeGraphQuery(engine, {
          kind: "DependencyQuery",
          nodeId: "B",
          direction: "dependents",
        }),
      ).toEqual(["A"]);
    },
  );
});
