import { describe, expect, it } from "vitest";

import { KnowledgeEdgeType } from "../../src/domain/knowledge-edge-type.js";
import { GraphValidationException } from "../../src/errors/graph-validation-exception.js";
import type { GraphOperationDescriptor } from "../../src/pipeline/graph-operation-descriptor.js";
import { GraphOperationType } from "../../src/pipeline/graph-operation-type.js";
import { runValidationStage } from "../../src/pipeline/validation-stage.js";

function descriptor<T>(
  overrides: Partial<GraphOperationDescriptor<T>> = {},
): GraphOperationDescriptor<T> {
  return {
    operation: GraphOperationType.CreateNode,
    validate: () => undefined,
    execute: () => undefined as T,
    ...overrides,
  };
}

describe("runValidationStage", () => {
  it("calls descriptor.validate()", () => {
    let called = false;
    runValidationStage(descriptor({ validate: () => (called = true) }));
    expect(called).toBe(true);
  });

  it("propagates a thrown error from descriptor.validate()", () => {
    expect(() =>
      runValidationStage(
        descriptor({
          validate: () => {
            throw new GraphValidationException("bad");
          },
        }),
      ),
    ).toThrow(GraphValidationException);
  });

  it("does nothing extra when there is no relationshipCandidate", () => {
    expect(() => runValidationStage(descriptor())).not.toThrow();
  });

  it("passes for a well-formed relationshipCandidate", () => {
    expect(() =>
      runValidationStage(
        descriptor({
          relationshipCandidate: {
            sourceNodeId: "A",
            targetNodeId: "B",
            edgeType: KnowledgeEdgeType.DependsOn,
          },
        }),
      ),
    ).not.toThrow();
  });

  it("throws GraphValidationException for an unknown edge type on the candidate", () => {
    expect(() =>
      runValidationStage(
        descriptor({
          relationshipCandidate: {
            sourceNodeId: "A",
            targetNodeId: "B",
            edgeType: "NotAType" as KnowledgeEdgeType,
          },
        }),
      ),
    ).toThrow(GraphValidationException);
  });
});
