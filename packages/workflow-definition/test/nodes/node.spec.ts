import { describe, expect, it } from "vitest";

import { ExpressionType } from "../../src/contracts/expression-type.js";
import { NodeType } from "../../src/contracts/node-type.js";
import { nodeSchema } from "../../src/nodes/node.js";

const literal = (value: unknown) => ({ type: ExpressionType.LITERAL, value });

describe("Node Hierarchy Test — nodeSchema (13 Node Types)", () => {
  it("Start", () => {
    expect(nodeSchema.safeParse({ id: "n1", name: "Start", type: NodeType.START }).success).toBe(
      true,
    );
  });

  it("End", () => {
    expect(nodeSchema.safeParse({ id: "n1", name: "End", type: NodeType.END }).success).toBe(true);
  });

  it("Task, with an optional taskRef", () => {
    expect(
      nodeSchema.safeParse({ id: "n1", name: "T", type: NodeType.TASK, taskRef: "svc.do" }).success,
    ).toBe(true);
  });

  it("Capability, requiring a capability id", () => {
    expect(
      nodeSchema.safeParse({
        id: "n1",
        name: "C",
        type: NodeType.CAPABILITY,
        capability: "inventory.read",
      }).success,
    ).toBe(true);
    expect(nodeSchema.safeParse({ id: "n1", name: "C", type: NodeType.CAPABILITY }).success).toBe(
      false,
    );
  });

  it("Condition, requiring a condition expression", () => {
    expect(
      nodeSchema.safeParse({
        id: "n1",
        name: "Cond",
        type: NodeType.CONDITION,
        condition: literal(true),
      }).success,
    ).toBe(true);
  });

  it("Decision, requiring at least one branch", () => {
    expect(
      nodeSchema.safeParse({
        id: "n1",
        name: "D",
        type: NodeType.DECISION,
        branches: [{ condition: literal(true), transitionId: "t-1" }],
      }).success,
    ).toBe(true);
    expect(
      nodeSchema.safeParse({ id: "n1", name: "D", type: NodeType.DECISION, branches: [] }).success,
    ).toBe(false);
  });

  it("Parallel, requiring at least 2 branch node ids", () => {
    expect(
      nodeSchema.safeParse({
        id: "n1",
        name: "P",
        type: NodeType.PARALLEL,
        branchNodeIds: ["a", "b"],
      }).success,
    ).toBe(true);
    expect(
      nodeSchema.safeParse({ id: "n1", name: "P", type: NodeType.PARALLEL, branchNodeIds: ["a"] })
        .success,
    ).toBe(false);
  });

  it("Merge, requiring at least 2 join node ids, defaulting waitForAll to true", () => {
    const result = nodeSchema.safeParse({
      id: "n1",
      name: "M",
      type: NodeType.MERGE,
      joinNodeIds: ["a", "b"],
    });
    expect(result.success).toBe(true);
    if (result.success && result.data.type === NodeType.MERGE) {
      expect(result.data.waitForAll).toBe(true);
    }
  });

  it("Loop, requiring loopCondition and bodyNodeId", () => {
    expect(
      nodeSchema.safeParse({
        id: "n1",
        name: "L",
        type: NodeType.LOOP,
        loopCondition: literal(true),
        bodyNodeId: "body-1",
        maxIterations: 10,
      }).success,
    ).toBe(true);
  });

  it("Delay, requiring a positive durationMs", () => {
    expect(
      nodeSchema.safeParse({ id: "n1", name: "Delay", type: NodeType.DELAY, durationMs: 1000 })
        .success,
    ).toBe(true);
    expect(
      nodeSchema.safeParse({ id: "n1", name: "Delay", type: NodeType.DELAY, durationMs: 0 })
        .success,
    ).toBe(false);
  });

  it("Wait, with an optional waitCondition", () => {
    expect(nodeSchema.safeParse({ id: "n1", name: "W", type: NodeType.WAIT }).success).toBe(true);
    expect(
      nodeSchema.safeParse({
        id: "n1",
        name: "W",
        type: NodeType.WAIT,
        waitCondition: literal(true),
      }).success,
    ).toBe(true);
  });

  it("Human, with optional assigneeRole/formRef", () => {
    expect(
      nodeSchema.safeParse({
        id: "n1",
        name: "H",
        type: NodeType.HUMAN,
        assigneeRole: "approver",
        formRef: "form-1",
      }).success,
    ).toBe(true);
  });

  it("SubWorkflow, requiring a subWorkflowId", () => {
    expect(
      nodeSchema.safeParse({
        id: "n1",
        name: "SW",
        type: NodeType.SUB_WORKFLOW,
        subWorkflowId: "other-workflow",
        subWorkflowVersion: "1.0.0",
      }).success,
    ).toBe(true);
  });

  it("rejects an unknown node type", () => {
    expect(nodeSchema.safeParse({ id: "n1", name: "X", type: "bogus" }).success).toBe(false);
  });

  it("every node shares the base Node Contract (retry/timeout/compensation/metadata/variables/input/output)", () => {
    const result = nodeSchema.safeParse({
      id: "n1",
      name: "Task",
      type: NodeType.TASK,
      description: "does work",
      input: { orderId: "string" },
      output: { result: "string" },
      variables: [],
      retry: { strategy: "linear", maxAttempts: 3 },
      timeout: { durationMs: 5000 },
      compensation: { compensationNodeId: "undo-1" },
      metadata: { owner: "team-a" },
    });
    expect(result.success).toBe(true);
  });
});
