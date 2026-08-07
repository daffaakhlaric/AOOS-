import { describe, expect, it } from "vitest";

import { KnowledgeEdgeType } from "../../src/domain/knowledge-edge-type.js";
import { CycleDetectedException } from "../../src/errors/cycle-detected-exception.js";
import { runCycleDetectionStage } from "../../src/pipeline/cycle-detection-stage.js";
import type { GraphOperationDescriptor } from "../../src/pipeline/graph-operation-descriptor.js";
import { GraphOperationType } from "../../src/pipeline/graph-operation-type.js";
import { buildResolvedConfiguration } from "../helpers/configuration-fixture.js";
import { buildCycleCandidateEngine } from "../helpers/graph-fixtures.js";

function descriptor(overrides: Partial<GraphOperationDescriptor<unknown>> = {}) {
  return {
    operation: GraphOperationType.CreateEdge,
    validate: () => undefined,
    execute: () => undefined,
    ...overrides,
  } as GraphOperationDescriptor<unknown>;
}

describe("runCycleDetectionStage", () => {
  it("rejects a proposed edge that would close a cycle in a checked edge type", () => {
    const engine = buildCycleCandidateEngine();
    expect(() =>
      runCycleDetectionStage(
        descriptor({
          engine,
          checkCycles: true,
          relationshipCandidate: {
            sourceNodeId: "Z",
            targetNodeId: "X",
            edgeType: KnowledgeEdgeType.DependsOn,
          },
        }),
        buildResolvedConfiguration(),
      ),
    ).toThrow(CycleDetectedException);
  });

  it("accepts a proposed edge that does not close a cycle", () => {
    const engine = buildCycleCandidateEngine();
    expect(() =>
      runCycleDetectionStage(
        descriptor({
          engine,
          checkCycles: true,
          relationshipCandidate: {
            sourceNodeId: "Z",
            targetNodeId: "W",
            edgeType: KnowledgeEdgeType.DependsOn,
          },
        }),
        buildResolvedConfiguration(),
      ),
    ).not.toThrow();
  });

  it("is a no-op when checkCycles is not set", () => {
    const engine = buildCycleCandidateEngine();
    expect(() =>
      runCycleDetectionStage(
        descriptor({
          engine,
          relationshipCandidate: {
            sourceNodeId: "Z",
            targetNodeId: "X",
            edgeType: KnowledgeEdgeType.DependsOn,
          },
        }),
        buildResolvedConfiguration(),
      ),
    ).not.toThrow();
  });

  it("is a no-op when there is no relationshipCandidate", () => {
    expect(() =>
      runCycleDetectionStage(descriptor({ checkCycles: true }), buildResolvedConfiguration()),
    ).not.toThrow();
  });

  it("is a no-op when there is no engine", () => {
    expect(() =>
      runCycleDetectionStage(
        descriptor({
          checkCycles: true,
          relationshipCandidate: {
            sourceNodeId: "Z",
            targetNodeId: "X",
            edgeType: KnowledgeEdgeType.DependsOn,
          },
        }),
        buildResolvedConfiguration(),
      ),
    ).not.toThrow();
  });

  it("is a no-op when the candidate's edge type is not in cycleCheckedEdgeTypes", () => {
    const engine = buildCycleCandidateEngine();
    expect(() =>
      runCycleDetectionStage(
        descriptor({
          engine,
          checkCycles: true,
          relationshipCandidate: {
            sourceNodeId: "Z",
            targetNodeId: "X",
            edgeType: KnowledgeEdgeType.RelatedTo,
          },
        }),
        buildResolvedConfiguration({
          cycleCheckedEdgeTypes: new Set([KnowledgeEdgeType.DependsOn]),
        }),
      ),
    ).not.toThrow();
  });
});
