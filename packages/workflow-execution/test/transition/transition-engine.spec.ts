import { describe, expect, it } from "vitest";

import { incrementLoopIteration } from "../../src/cursor/advance-cursor.js";
import { createExecutionCursor } from "../../src/cursor/create-execution-cursor.js";
import { TransitionResolutionException } from "../../src/errors/transition-resolution-exception.js";
import { buildExecutionGraph } from "../../src/graph/execution-graph.js";
import { TransitionEngine } from "../../src/transition/transition-engine.js";
import {
  brokenDefinitionFixture,
  definitionFixture,
  failureTransitionDefinitionFixture,
  loopDefinitionFixture,
  parallelDefinitionFixture,
  timeoutRetryDefinitionFixture,
} from "../helpers/definition-fixture.js";

describe("Transition Engine Test — TransitionEngine", () => {
  it("resolves the single NEXT edge on success", () => {
    const graph = buildExecutionGraph(definitionFixture());
    const cursor = createExecutionCursor("start");
    const engine = new TransitionEngine();
    const resolved = engine.resolve({ graph, cursor, outcome: "success" });
    expect(resolved.nextNodeIds).toEqual(["cap-1"]);
    expect(resolved.isLoopBack).toBe(false);
  });

  it("returns no next nodes when the current Node is an End Node", () => {
    const graph = buildExecutionGraph(definitionFixture());
    const cursor = createExecutionCursor("end");
    const engine = new TransitionEngine();
    expect(engine.resolve({ graph, cursor, outcome: "success" }).nextNodeIds).toEqual([]);
  });

  it("throws TransitionResolutionException on 'success' from a non-End dead-end Node", () => {
    const graph = buildExecutionGraph(brokenDefinitionFixture());
    const cursor = createExecutionCursor("dead-end");
    const engine = new TransitionEngine();
    expect(() => engine.resolve({ graph, cursor, outcome: "success" })).toThrow(
      TransitionResolutionException,
    );
  });

  it("treats 'manual' the same as 'success'", () => {
    const graph = buildExecutionGraph(definitionFixture());
    const cursor = createExecutionCursor("start");
    const engine = new TransitionEngine();
    expect(engine.resolve({ graph, cursor, outcome: "manual" }).nextNodeIds).toEqual(["cap-1"]);
  });

  it("returns an empty next-node list on 'cancelled'", () => {
    const graph = buildExecutionGraph(definitionFixture());
    const cursor = createExecutionCursor("start");
    const engine = new TransitionEngine();
    expect(engine.resolve({ graph, cursor, outcome: "cancelled" }).nextNodeIds).toEqual([]);
  });

  it("follows a FAILURE-kind edge when the outcome is 'failure'", () => {
    const graph = buildExecutionGraph(failureTransitionDefinitionFixture());
    const cursor = createExecutionCursor("cap-1");
    const engine = new TransitionEngine();
    expect(engine.resolve({ graph, cursor, outcome: "failure" }).nextNodeIds).toEqual(["recovery"]);
  });

  it("returns no next nodes on 'failure' with no FAILURE-kind edge (a business failure, not a thrown error)", () => {
    const graph = buildExecutionGraph(definitionFixture());
    const cursor = createExecutionCursor("cap-1");
    const engine = new TransitionEngine();
    expect(engine.resolve({ graph, cursor, outcome: "failure" }).nextNodeIds).toEqual([]);
  });

  it("returns no next nodes on 'timeout' with no TIMEOUT-kind edge", () => {
    const graph = buildExecutionGraph(definitionFixture());
    const cursor = createExecutionCursor("cap-1");
    const engine = new TransitionEngine();
    expect(engine.resolve({ graph, cursor, outcome: "timeout" }).nextNodeIds).toEqual([]);
  });

  it("follows a TIMEOUT-kind edge when one is present", () => {
    const graph = buildExecutionGraph(timeoutRetryDefinitionFixture());
    const cursor = createExecutionCursor("cap-1");
    const engine = new TransitionEngine();
    expect(engine.resolve({ graph, cursor, outcome: "timeout" }).nextNodeIds).toEqual([
      "timeout-handler",
    ]);
  });

  it("follows a RETRY-kind edge when one is present", () => {
    const graph = buildExecutionGraph(timeoutRetryDefinitionFixture());
    const cursor = createExecutionCursor("cap-1");
    const engine = new TransitionEngine();
    expect(engine.resolve({ graph, cursor, outcome: "retry" }).nextNodeIds).toEqual([
      "retry-handler",
    ]);
  });

  it("stays on the current Node on 'retry' when there is no RETRY-kind edge", () => {
    const graph = buildExecutionGraph(definitionFixture());
    const cursor = createExecutionCursor("cap-1");
    const engine = new TransitionEngine();
    expect(engine.resolve({ graph, cursor, outcome: "retry" }).nextNodeIds).toEqual(["cap-1"]);
  });

  it("follows the fan-out PARALLEL edges and the fan-in MERGE edge", () => {
    const graph = buildExecutionGraph(parallelDefinitionFixture());
    const engine = new TransitionEngine();
    const startCursor = createExecutionCursor("start");
    expect(
      engine.resolve({ graph, cursor: startCursor, outcome: "success" }).nextNodeIds.sort(),
    ).toEqual(["cap-a", "cap-b"]);
    const branchCursor = createExecutionCursor("cap-a");
    expect(engine.resolve({ graph, cursor: branchCursor, outcome: "success" }).nextNodeIds).toEqual(
      ["end"],
    );
  });

  it("loops back on a Loop Node while under maxLoopIterations", () => {
    const graph = buildExecutionGraph(loopDefinitionFixture());
    const cursor = createExecutionCursor("loop-1");
    const engine = new TransitionEngine();
    const resolved = engine.resolve({ graph, cursor, outcome: "success", maxLoopIterations: 1 });
    expect(resolved.isLoopBack).toBe(true);
    expect(resolved.nextNodeIds).toEqual(["body-1"]);
  });

  it("exits a Loop Node once maxLoopIterations is reached", () => {
    const graph = buildExecutionGraph(loopDefinitionFixture());
    let cursor = createExecutionCursor("loop-1");
    cursor = incrementLoopIteration(cursor, "loop-1");
    const engine = new TransitionEngine();
    const resolved = engine.resolve({ graph, cursor, outcome: "success", maxLoopIterations: 1 });
    expect(resolved.isLoopBack).toBe(false);
    expect(resolved.nextNodeIds).toEqual(["end"]);
  });

  it("follows the LOOP-kind back-edge from the loop body on success", () => {
    const graph = buildExecutionGraph(loopDefinitionFixture());
    const cursor = createExecutionCursor("body-1");
    const engine = new TransitionEngine();
    expect(engine.resolve({ graph, cursor, outcome: "success" }).nextNodeIds).toEqual(["loop-1"]);
  });
});
