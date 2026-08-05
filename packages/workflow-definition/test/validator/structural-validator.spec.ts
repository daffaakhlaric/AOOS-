import { describe, expect, it } from "vitest";

import { ExpressionType } from "../../src/contracts/expression-type.js";
import { NodeType } from "../../src/contracts/node-type.js";
import { StructuralValidator } from "../../src/validator/structural-validator.js";
import { workflowFixture } from "../helpers/workflow-fixture.js";

describe("Workflow Validation / Node Validation Test — StructuralValidator", () => {
  it("passes a well-formed workflow", () => {
    expect(new StructuralValidator().validate(workflowFixture()).valid).toBe(true);
  });

  it("fails when there is no Start node", () => {
    const workflow = workflowFixture({
      nodes: [
        { id: "task-1", name: "T", type: NodeType.TASK },
        { id: "end", name: "End", type: NodeType.END },
      ],
    });
    const result = new StructuralValidator().validate(workflow);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.message.includes("exactly one Start"))).toBe(true);
  });

  it("fails when there are two Start nodes", () => {
    const workflow = workflowFixture({
      nodes: [
        { id: "start-1", name: "S1", type: NodeType.START },
        { id: "start-2", name: "S2", type: NodeType.START },
        { id: "end", name: "End", type: NodeType.END },
      ],
    });
    expect(new StructuralValidator().validate(workflow).valid).toBe(false);
  });

  it("fails when there is no End node", () => {
    const workflow = workflowFixture({
      nodes: [{ id: "start", name: "S", type: NodeType.START }],
    });
    const result = new StructuralValidator().validate(workflow);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.message.includes("at least one End"))).toBe(true);
  });

  it("fails when a Parallel node's branchNodeIds reference an unknown node", () => {
    const workflow = workflowFixture({
      nodes: [
        { id: "start", name: "S", type: NodeType.START },
        { id: "p", name: "P", type: NodeType.PARALLEL, branchNodeIds: ["ghost-1", "ghost-2"] },
        { id: "end", name: "E", type: NodeType.END },
      ],
    });
    const result = new StructuralValidator().validate(workflow);
    expect(result.valid).toBe(false);
    expect(result.issues).toHaveLength(2);
  });

  it("fails when a Merge node's joinNodeIds reference an unknown node", () => {
    const workflow = workflowFixture({
      nodes: [
        { id: "start", name: "S", type: NodeType.START },
        { id: "m", name: "M", type: NodeType.MERGE, joinNodeIds: ["ghost-1", "ghost-2"] },
        { id: "end", name: "E", type: NodeType.END },
      ],
    });
    expect(new StructuralValidator().validate(workflow).valid).toBe(false);
  });

  it("fails when a Loop node's bodyNodeId references an unknown node", () => {
    const workflow = workflowFixture({
      nodes: [
        { id: "start", name: "S", type: NodeType.START },
        {
          id: "loop",
          name: "L",
          type: NodeType.LOOP,
          loopCondition: { type: ExpressionType.LITERAL, value: true },
          bodyNodeId: "ghost",
        },
        { id: "end", name: "E", type: NodeType.END },
      ],
    });
    expect(new StructuralValidator().validate(workflow).valid).toBe(false);
  });

  it("fails when a node's compensation.compensationNodeId is unknown", () => {
    const workflow = workflowFixture({
      nodes: [
        { id: "start", name: "S", type: NodeType.START },
        {
          id: "task-1",
          name: "T",
          type: NodeType.TASK,
          compensation: { compensationNodeId: "ghost" },
        },
        { id: "end", name: "E", type: NodeType.END },
      ],
    });
    expect(new StructuralValidator().validate(workflow).valid).toBe(false);
  });

  it("fails when the workflow-level compensation.compensationNodeId is unknown", () => {
    const workflow = workflowFixture({ compensation: { compensationNodeId: "ghost" } });
    expect(new StructuralValidator().validate(workflow).valid).toBe(false);
  });

  it("passes when compensation node ids resolve", () => {
    const workflow = workflowFixture({
      nodes: [
        { id: "start", name: "S", type: NodeType.START },
        {
          id: "task-1",
          name: "T",
          type: NodeType.TASK,
          compensation: { compensationNodeId: "undo-1" },
        },
        { id: "undo-1", name: "Undo", type: NodeType.TASK },
        { id: "end", name: "E", type: NodeType.END },
      ],
      transitions: [],
      compensation: { compensationNodeId: "undo-1" },
    });
    expect(new StructuralValidator().validate(workflow).valid).toBe(true);
  });
});
