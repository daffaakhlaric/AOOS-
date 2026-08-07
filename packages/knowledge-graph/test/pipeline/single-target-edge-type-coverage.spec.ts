import { describe, expect, it } from "vitest";

import { SINGLE_TARGET_EDGE_TYPES } from "../../src/edges/edge-type-semantics.js";
import { RelationshipValidationException } from "../../src/errors/relationship-validation-exception.js";
import { GraphEngine } from "../../src/graph/graph-engine.js";
import type { GraphOperationDescriptor } from "../../src/pipeline/graph-operation-descriptor.js";
import { GraphOperationType } from "../../src/pipeline/graph-operation-type.js";
import { runRelationshipValidationStage } from "../../src/pipeline/relationship-validation-stage.js";
import { buildResolvedConfiguration } from "../helpers/configuration-fixture.js";
import { addNode } from "../helpers/graph-fixtures.js";

describe("runRelationshipValidationStage — every single-target edge type", () => {
  it.each(Array.from(SINGLE_TARGET_EDGE_TYPES))(
    "rejects a second outgoing %s edge from the same source",
    (edgeType) => {
      const engine = GraphEngine.create({ name: "g" });
      addNode(engine, "A");
      addNode(engine, "B");
      addNode(engine, "C");
      engine.addEdge({
        id: "first",
        type: edgeType,
        sourceNodeId: "A",
        targetNodeId: "B",
        weight: 1,
        metadata: {},
        createdAt: 0,
        updatedAt: 0,
      });

      const descriptor: GraphOperationDescriptor<unknown> = {
        operation: GraphOperationType.CreateEdge,
        engine,
        validate: () => undefined,
        execute: () => undefined,
        relationshipCandidate: { sourceNodeId: "A", targetNodeId: "C", edgeType },
      };
      expect(() =>
        runRelationshipValidationStage(descriptor, buildResolvedConfiguration()),
      ).toThrow(RelationshipValidationException);
    },
  );
});
