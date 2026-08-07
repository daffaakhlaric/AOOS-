import { describe, expect, it } from "vitest";

import { KnowledgeEdgeType } from "../../src/domain/knowledge-edge-type.js";
import { RelationshipValidationException } from "../../src/errors/relationship-validation-exception.js";
import { GraphEngine } from "../../src/graph/graph-engine.js";
import type { GraphOperationDescriptor } from "../../src/pipeline/graph-operation-descriptor.js";
import { GraphOperationType } from "../../src/pipeline/graph-operation-type.js";
import { runRelationshipValidationStage } from "../../src/pipeline/relationship-validation-stage.js";
import { buildResolvedConfiguration } from "../helpers/configuration-fixture.js";
import { addEdge, addNode } from "../helpers/graph-fixtures.js";

function descriptor(overrides: Partial<GraphOperationDescriptor<unknown>> = {}) {
  return {
    operation: GraphOperationType.CreateEdge,
    validate: () => undefined,
    execute: () => undefined,
    ...overrides,
  } as GraphOperationDescriptor<unknown>;
}

describe("runRelationshipValidationStage", () => {
  it("is a no-op when there is no relationshipCandidate", () => {
    expect(() =>
      runRelationshipValidationStage(descriptor(), buildResolvedConfiguration()),
    ).not.toThrow();
  });

  it("is a no-op when there is no engine", () => {
    expect(() =>
      runRelationshipValidationStage(
        descriptor({
          relationshipCandidate: {
            sourceNodeId: "A",
            targetNodeId: "B",
            edgeType: KnowledgeEdgeType.ChildOf,
          },
        }),
        buildResolvedConfiguration(),
      ),
    ).not.toThrow();
  });

  it("rejects an inverse-pair contradiction (ChildOf when ParentOf already exists)", () => {
    const engine = GraphEngine.create({ name: "g" });
    addNode(engine, "A");
    addNode(engine, "B");
    addEdge(engine, "A", "B", KnowledgeEdgeType.ParentOf);

    expect(() =>
      runRelationshipValidationStage(
        descriptor({
          engine,
          relationshipCandidate: {
            sourceNodeId: "A",
            targetNodeId: "B",
            edgeType: KnowledgeEdgeType.ChildOf,
          },
        }),
        buildResolvedConfiguration(),
      ),
    ).toThrow(RelationshipValidationException);
  });

  it("does not reject a non-contradicting inverse-type edge (different node pair)", () => {
    const engine = GraphEngine.create({ name: "g" });
    addNode(engine, "A");
    addNode(engine, "B");
    addNode(engine, "C");
    addEdge(engine, "A", "B", KnowledgeEdgeType.ParentOf);

    expect(() =>
      runRelationshipValidationStage(
        descriptor({
          engine,
          relationshipCandidate: {
            sourceNodeId: "A",
            targetNodeId: "C",
            edgeType: KnowledgeEdgeType.ChildOf,
          },
        }),
        buildResolvedConfiguration(),
      ),
    ).not.toThrow();
  });

  it("tolerates a contradiction when strictRelationshipValidation is false", () => {
    const engine = GraphEngine.create({ name: "g" });
    addNode(engine, "A");
    addNode(engine, "B");
    addEdge(engine, "A", "B", KnowledgeEdgeType.ParentOf);

    expect(() =>
      runRelationshipValidationStage(
        descriptor({
          engine,
          relationshipCandidate: {
            sourceNodeId: "A",
            targetNodeId: "B",
            edgeType: KnowledgeEdgeType.ChildOf,
          },
        }),
        buildResolvedConfiguration({ strictRelationshipValidation: false }),
      ),
    ).not.toThrow();
  });

  it("rejects a second outgoing edge of a single-target type (VersionOf)", () => {
    const engine = GraphEngine.create({ name: "g" });
    addNode(engine, "A");
    addNode(engine, "B");
    addNode(engine, "C");
    addEdge(engine, "A", "B", KnowledgeEdgeType.VersionOf);

    expect(() =>
      runRelationshipValidationStage(
        descriptor({
          engine,
          relationshipCandidate: {
            sourceNodeId: "A",
            targetNodeId: "C",
            edgeType: KnowledgeEdgeType.VersionOf,
          },
        }),
        buildResolvedConfiguration(),
      ),
    ).toThrow(RelationshipValidationException);
  });

  it("allows the first outgoing edge of a single-target type", () => {
    const engine = GraphEngine.create({ name: "g" });
    addNode(engine, "A");
    addNode(engine, "B");

    expect(() =>
      runRelationshipValidationStage(
        descriptor({
          engine,
          relationshipCandidate: {
            sourceNodeId: "A",
            targetNodeId: "B",
            edgeType: KnowledgeEdgeType.VersionOf,
          },
        }),
        buildResolvedConfiguration(),
      ),
    ).not.toThrow();
  });

  it("tolerates a single-target cardinality violation when strictRelationshipValidation is false", () => {
    const engine = GraphEngine.create({ name: "g" });
    addNode(engine, "A");
    addNode(engine, "B");
    addNode(engine, "C");
    addEdge(engine, "A", "B", KnowledgeEdgeType.VersionOf);

    expect(() =>
      runRelationshipValidationStage(
        descriptor({
          engine,
          relationshipCandidate: {
            sourceNodeId: "A",
            targetNodeId: "C",
            edgeType: KnowledgeEdgeType.VersionOf,
          },
        }),
        buildResolvedConfiguration({ strictRelationshipValidation: false }),
      ),
    ).not.toThrow();
  });

  it("does not apply single-target rules to non-single-target edge types", () => {
    const engine = GraphEngine.create({ name: "g" });
    addNode(engine, "A");
    addNode(engine, "B");
    addNode(engine, "C");
    addEdge(engine, "A", "B", KnowledgeEdgeType.RelatedTo);

    expect(() =>
      runRelationshipValidationStage(
        descriptor({
          engine,
          relationshipCandidate: {
            sourceNodeId: "A",
            targetNodeId: "C",
            edgeType: KnowledgeEdgeType.RelatedTo,
          },
        }),
        buildResolvedConfiguration(),
      ),
    ).not.toThrow();
  });
});
