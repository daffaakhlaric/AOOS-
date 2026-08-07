import { describe, expect, it } from "vitest";

import { KnowledgeEdgeType } from "../../src/domain/knowledge-edge-type.js";
import { CycleDetectedException } from "../../src/errors/cycle-detected-exception.js";
import { GraphAuthorizationException } from "../../src/errors/graph-authorization-exception.js";
import { GraphValidationException } from "../../src/errors/graph-validation-exception.js";
import type { PipelineMiddleware } from "../../src/middleware/pipeline-middleware.js";
import type { GraphOperationDescriptor } from "../../src/pipeline/graph-operation-descriptor.js";
import { GraphOperationPipeline } from "../../src/pipeline/graph-operation-pipeline.js";
import { GraphOperationType } from "../../src/pipeline/graph-operation-type.js";
import { buildResolvedConfiguration } from "../helpers/configuration-fixture.js";
import { buildCycleCandidateEngine } from "../helpers/graph-fixtures.js";

describe("GraphOperationPipeline", () => {
  it("runs all 7 stages in order for a successful operation", () => {
    const calls: string[] = [];
    const pipeline = new GraphOperationPipeline();
    const descriptor: GraphOperationDescriptor<string> = {
      operation: GraphOperationType.CreateNode,
      validate: () => calls.push("validate"),
      execute: () => {
        calls.push("execute");
        return "output";
      },
      recordMetrics: () => calls.push("metrics"),
      emitEvents: () => calls.push("events"),
    };
    const result = pipeline.execute(descriptor, buildResolvedConfiguration());
    expect(result).toBe("output");
    expect(calls).toEqual(["validate", "execute", "metrics", "events"]);
  });

  it("stops before Execution when Validation throws", () => {
    const calls: string[] = [];
    const pipeline = new GraphOperationPipeline();
    expect(() =>
      pipeline.execute(
        {
          operation: GraphOperationType.CreateNode,
          validate: () => {
            throw new GraphValidationException("bad");
          },
          execute: () => calls.push("execute"),
        },
        buildResolvedConfiguration(),
      ),
    ).toThrow(GraphValidationException);
    expect(calls).toEqual([]);
  });

  it("stops before Execution when Authorization denies", () => {
    const calls: string[] = [];
    const pipeline = new GraphOperationPipeline();
    expect(() =>
      pipeline.execute(
        {
          operation: GraphOperationType.CreateNode,
          validate: () => undefined,
          execute: () => calls.push("execute"),
        },
        buildResolvedConfiguration({ authorizationChecker: { isAuthorized: () => false } }),
      ),
    ).toThrow(GraphAuthorizationException);
    expect(calls).toEqual([]);
  });

  it("rejects a cycle-introducing edge before Execution, and accepts a valid one", () => {
    const engine = buildCycleCandidateEngine();
    const pipeline = new GraphOperationPipeline();
    const configuration = buildResolvedConfiguration();
    let executed = false;

    expect(() =>
      pipeline.execute(
        {
          operation: GraphOperationType.CreateEdge,
          engine,
          checkCycles: true,
          relationshipCandidate: {
            sourceNodeId: "Z",
            targetNodeId: "X",
            edgeType: KnowledgeEdgeType.DependsOn,
          },
          validate: () => undefined,
          execute: () => (executed = true),
        },
        configuration,
      ),
    ).toThrow(CycleDetectedException);
    expect(executed).toBe(false);

    const result = pipeline.execute(
      {
        operation: GraphOperationType.CreateEdge,
        engine,
        checkCycles: true,
        relationshipCandidate: {
          sourceNodeId: "Z",
          targetNodeId: "W",
          edgeType: KnowledgeEdgeType.DependsOn,
        },
        validate: () => undefined,
        execute: () => (executed = true),
      },
      configuration,
    );
    expect(result).toBe(true);
    expect(executed).toBe(true);
  });

  it("wraps execution with middlewares in order, and lets a middleware short-circuit", () => {
    const calls: string[] = [];
    const outer: PipelineMiddleware = {
      around: (_descriptor, next) => {
        calls.push("outer-before");
        const result = next();
        calls.push("outer-after");
        return result;
      },
    };
    const inner: PipelineMiddleware = {
      around: (_descriptor, next) => {
        calls.push("inner-before");
        const result = next();
        calls.push("inner-after");
        return result;
      },
    };
    const pipeline = new GraphOperationPipeline([outer, inner]);
    pipeline.execute(
      {
        operation: GraphOperationType.CreateNode,
        validate: () => undefined,
        execute: () => calls.push("execute"),
      },
      buildResolvedConfiguration(),
    );
    expect(calls).toEqual([
      "outer-before",
      "inner-before",
      "execute",
      "inner-after",
      "outer-after",
    ]);
  });

  it("a middleware can short-circuit without calling next()", () => {
    let executed = false;
    const shortCircuit: PipelineMiddleware = {
      around: () => "short-circuited",
    };
    const pipeline = new GraphOperationPipeline([shortCircuit]);
    const result = pipeline.execute(
      {
        operation: GraphOperationType.CreateNode,
        validate: () => undefined,
        execute: () => {
          executed = true;
          return "real-output";
        },
      },
      buildResolvedConfiguration(),
    );
    expect(result).toBe("short-circuited");
    expect(executed).toBe(false);
  });
});
